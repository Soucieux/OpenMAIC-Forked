"""Serve one pinned, already-cached speech model for this Mac project."""

import io
import json
import os
import string
import sys
import wave
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import runtime_constants as C

os.environ.update(C.OFFLINE_ENV)
PROJECT_ROOT = Path(__file__).resolve().parents[2]


class SpeechRuntime:
    """Keep model memory in this process and voice settings in this project."""

    def __init__(self) -> None:
        """Read project configuration and validate storage without downloading files."""
        config_path = PROJECT_ROOT / C.CONFIG_DIR / C.CONFIG_NAME
        if not config_path.is_file():
            config_path = Path(__file__).with_name(C.EXAMPLE_NAME)
        self.config = json.loads(config_path.read_text())
        if not isinstance(self.config, dict):
            raise ValueError(C.BAD_CONFIG)
        self.port = self.config.get(C.PORT_KEY)
        self.max_tokens = self.config.get(C.MAX_TOKENS, 2048)
        revision = self.config.get(C.REVISION_KEY)
        if (
            self.config.get(C.MODEL_KEY) != C.MODEL_ID
            or not isinstance(revision, str)
            or len(revision) != 40
            or not all(character in string.hexdigits for character in revision)
            or type(self.port) is not int
            or not 1024 <= self.port <= 65535
            or type(self.max_tokens) is not int
            or not 32 <= self.max_tokens <= 4096
        ):
            raise ValueError(C.BAD_CONFIG)
        self.model = None
        self.reference = None
        reference = self.config.get(C.REFERENCE_AUDIO)
        if reference:
            candidate = (PROJECT_ROOT / reference).resolve(strict=True)
            if not candidate.is_relative_to(PROJECT_ROOT) or not candidate.is_file():
                raise ValueError(C.BAD_REFERENCE)
            self.reference = str(candidate)
        elif self.config.get(C.REFERENCE_TEXT):
            raise ValueError(C.BAD_REFERENCE)
        self.snapshot = self.check_store()

    def check_store(self) -> Path:
        """Return the pinned complete snapshot or fail without creating a cache."""
        root = Path(self.config[C.MODEL_ROOT]).expanduser().resolve()
        if not root.is_mount():
            raise FileNotFoundError(C.MISSING_STORE)
        repository = C.REPO_PREFIX + C.MODEL_ID.replace(C.SLASH, C.REPO_SEPARATOR)
        snapshot = root.joinpath(*C.HUB_PARTS, repository, C.SNAPSHOTS, self.config[C.REVISION_KEY])
        if not snapshot.is_dir() or not list(snapshot.glob(C.WEIGHT_GLOB)):
            raise FileNotFoundError(C.MISSING_MODEL)
        for item in snapshot.rglob(C.ALL_FILES):
            if item.is_symlink() and (not item.exists() or not item.resolve().is_relative_to(root)):
                raise FileNotFoundError(C.MISSING_MODEL)
        metadata = json.loads((snapshot / C.MODEL_CONFIG).read_text())
        if metadata.get(C.MODEL_TYPE) != C.QWEN_TYPE or metadata.get(C.TTS_MODEL_TYPE) != C.BASE_TYPE:
            raise ValueError(C.WRONG_MODEL)
        return snapshot

    def generate(self, payload: object) -> bytes:
        """Validate one request and return WAV bytes using only the shared snapshot.

        Args:
            payload: Decoded JSON request from the local application.
        Returns:
            Mono, 16-bit PCM WAV data. No generated file is written by this service.
        """
        if not isinstance(payload, dict):
            raise ValueError(C.BAD_REQUEST)
        text = payload.get(C.INPUT_KEY)
        if (
            payload.get(C.MODEL_KEY) != C.MODEL_ID
            or not isinstance(text, str)
            or not 1 <= len(text.strip()) <= 2000
            or payload.get(C.VOICE_KEY, C.DEFAULT_VOICE) != C.DEFAULT_VOICE
            or payload.get(C.SPEED_KEY, 1) != 1
            or payload.get(C.FORMAT_KEY, C.WAV_FORMAT) != C.WAV_FORMAT
            or payload.get(C.STREAM_KEY, False) is not False
        ):
            raise ValueError(C.BAD_REQUEST)
        self.check_store()
        from mlx_audio.tts.utils import load_model
        import numpy as np

        if self.model is None:
            self.model = load_model(str(self.snapshot))
        options = {
            C.TEXT_ARG: text,
            C.LANGUAGE_KEY: payload.get(C.LANGUAGE_KEY, C.AUTO_LANGUAGE),
            C.MAX_TOKENS: self.max_tokens,
            C.REF_AUDIO_ARG: self.reference,
            C.REF_TEXT_ARG: self.config.get(C.REFERENCE_TEXT),
        }
        chunks = []
        sample_rate = 24000
        for result in getattr(self.model, C.GENERATE)(**options):
            chunks.append(np.asarray(getattr(result, C.AUDIO_ATTR), dtype=np.float32).reshape(-1))
            sample_rate = getattr(result, C.RATE_ATTR)
        if not chunks:
            raise RuntimeError(C.NO_AUDIO)
        pcm = (np.clip(np.concatenate(chunks), -1, 1) * 32767).astype(C.PCM_DTYPE)
        output = io.BytesIO()
        with wave.open(output, C.WRITE_MODE) as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(sample_rate)
            audio.writeframes(pcm.tobytes())
        return output.getvalue()


class SpeechHandler(BaseHTTPRequestHandler):
    """Expose only health, model metadata and bounded local speech requests."""

    runtime: SpeechRuntime
    timeout = 30

    def send_payload(self, status: int, payload: bytes, content_type: str) -> None:
        """Send a response without storing audio.

        Args:
            status: HTTP status code.
            payload: Encoded response bytes.
            content_type: Response MIME type.
        Returns:
            None.
        """
        self.send_response(status)
        self.send_header(C.CONTENT_TYPE, content_type)
        self.send_header(C.CONTENT_LENGTH, str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def fail(self, status: int, message: str) -> None:
        """Return an error without attempting another provider.

        Args:
            status: HTTP error status.
            message: Safe, actionable message for the application.
        Returns:
            None.
        """
        data = {C.ERROR_KEY: {C.MESSAGE_KEY: message}}
        self.send_payload(status, json.dumps(data).encode(C.UTF8), C.JSON_TYPE)

    def allowed(self) -> bool:
        """Check the Host and reject browser-origin requests; return whether allowed."""
        valid_hosts = {C.HOST_TEMPLATE.format(name=name, port=self.runtime.port) for name in C.LOOPBACK_NAMES}
        return self.headers.get(C.HOST_HEADER) in valid_hosts and not self.headers.get(C.ORIGIN_HEADER)

    def do_GET(self) -> None:
        """Return readiness/model metadata without exposing personal filesystem paths."""
        if not self.allowed():
            self.fail(403, C.BAD_ORIGIN)
            return
        if self.path not in (C.HEALTH_PATH, C.MODELS_PATH):
            self.fail(404, C.NOT_FOUND)
            return
        try:
            self.runtime.check_store()
            item = {C.ID_KEY: C.MODEL_ID, C.REVISION_KEY: self.runtime.config[C.REVISION_KEY]}
            data = {C.READY_KEY: True, C.LOADED_KEY: self.runtime.model is not None,
                    C.RUNTIME_KEY: C.RUNTIME_VERSION, C.DATA_KEY: [item]}
            self.send_payload(200, json.dumps(data).encode(C.UTF8), C.JSON_TYPE)
        except (OSError, ValueError):
            self.fail(503, C.MISSING_MODEL)

    def do_POST(self) -> None:
        """Generate one bounded request serially; never download or use a cloud API."""
        if not self.allowed():
            self.fail(403, C.BAD_ORIGIN)
            return
        if self.path != C.SPEECH_PATH:
            self.fail(404, C.NOT_FOUND)
            return
        try:
            length = int(self.headers.get(C.CONTENT_LENGTH, 0))
            if not 0 < length <= 65536 or self.headers.get_content_type() != C.JSON_TYPE:
                raise ValueError(C.BAD_REQUEST)
            payload = json.loads(self.rfile.read(length))
            audio = self.runtime.generate(payload)
            self.send_payload(200, audio, C.WAV_TYPE)
        except (BrokenPipeError, ConnectionResetError):
            return
        except ValueError as error:
            print(C.LOG_ERROR, error, flush=True)
            self.fail(400, C.BAD_REQUEST)
        except Exception as error:
            print(C.LOG_ERROR, error, flush=True)
            self.fail(503, C.GENERATION_FAILED)


def main() -> None:
    """Check configuration or serve locally until Control-C; return no value."""
    runtime = SpeechRuntime()
    if C.CHECK_FLAG in sys.argv:
        print(C.CHECK_OK)
        return
    SpeechHandler.runtime = runtime
    with HTTPServer((C.HOST, runtime.port), SpeechHandler) as server:
        print(C.READY_MESSAGE.format(port=runtime.port), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == C.MAIN:
    main()

"""
Logging configuration utility.
"""
import logging
import sys
from pathlib import Path

def setup_logger(app):
    """Configures application logger for stdout and log files."""
    log_dir = Path(app.root_path).parent / 'logs'
    log_dir.mkdir(exist_ok=True)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
    )
    handler.setFormatter(formatter)

    app.logger.setLevel(logging.INFO)
    app.logger.addHandler(handler)
    app.logger.info("Application Logger initialized successfully.")

"""Flask Application Configuration Classes"""
import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(os.path.join(BASE_DIR, '.env'))


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production-12345')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-jwt-secret-key-change-in-production-67890')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv('JWT_ACCESS_MINUTES', '30')))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv('JWT_REFRESH_DAYS', '7')))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', f'sqlite:///{os.path.join(BASE_DIR, "app.db")}')

    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost')
    PASSWORD_RESET_EXPIRES_SECONDS = int(os.getenv('PASSWORD_RESET_EXPIRES_SECONDS', '1800'))
    PASSWORD_RESET_RETURN_LINK = os.getenv('PASSWORD_RESET_RETURN_LINK', 'false').lower() in {'1', 'true', 'yes'}
    AUTO_VERIFY_NGO = os.getenv('AUTO_VERIFY_NGO', 'false').lower() in {'1', 'true', 'yes'}
    CORS_ORIGINS = [o.strip() for o in os.getenv(
        'CORS_ORIGINS',
        'http://localhost,http://localhost:3000,http://127.0.0.1:3000'
    ).split(',') if o.strip()]


class DevelopmentConfig(Config):
    DEBUG = True
    ENV = 'development'


class ProductionConfig(Config):
    DEBUG = False
    ENV = 'production'


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    AUTO_VERIFY_NGO = True


config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig,
}

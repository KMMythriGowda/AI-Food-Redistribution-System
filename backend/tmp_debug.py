import urllib.request
import json
from app import create_app
from app.models.user import User
from flask_jwt_extended import create_access_token

app = create_app('development')
with app.app_context():
    u = User.query.filter_by(email='supermarket@freshmart.com').first()
    token = create_access_token(identity=u.id)
    urls = [
        'http://127.0.0.1:5000/api/ai/model-metrics',
        'http://127.0.0.1:5000/api/ai/risk-summary',
        'http://127.0.0.1:5000/api/ai/risk-trends',
        'http://127.0.0.1:5000/api/ai/reorder-summary',
        'http://127.0.0.1:5000/api/ai/health',
        'http://127.0.0.1:8000/api/ai/model-metrics',
        'http://127.0.0.1:8000/api/ai/health',
    ]
    for url in urls:
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode('utf-8')
                print('URL', url)
                print('STATUS', resp.status)
                print(body[:800])
                print('---')
        except Exception as e:
            print('URL', url)
            print('ERROR', type(e).__name__, e)
            if hasattr(e, 'read'):
                try:
                    print(e.read().decode('utf-8')[:800])
                except Exception:
                    pass
            print('---')

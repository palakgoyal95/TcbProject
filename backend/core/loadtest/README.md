# Load Test Quickstart

## 1) Install Locust

```bash
pip install locust
```

## 2) Start backend

```bash
python manage.py runserver
```

## 3) Run load profile (CLI)

```bash
locust -f loadtest/locustfile.py --host http://127.0.0.1:8000 --headless --users 1000 --spawn-rate 100 --run-time 5m
```

## 4) Monitor runtime metrics

Call:

```bash
curl http://127.0.0.1:8000/api/metrics/
```

Or with token:

```bash
curl -H "X-Metrics-Token: <token>" http://127.0.0.1:8000/api/metrics/
```

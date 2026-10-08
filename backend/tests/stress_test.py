import asyncio
import httpx
import time
import sys

BASE_URL = "http://127.0.0.1:5000"

async def send_request(client, url, method="GET", json_data=None, headers=None):
    start = time.time()
    try:
        if method == "POST":
            r = await client.post(url, json=json_data, headers=headers, timeout=10.0)
        else:
            r = await client.get(url, headers=headers, timeout=10.0)
        latency = time.time() - start
        return r.status_code, latency
    except Exception as e:
        latency = time.time() - start
        return 0, latency

async def run_load_test(concurrency=10, total_requests=100):
    print(f"Starting Load Test with Concurrency: {concurrency}, Total Requests: {total_requests}")
    
    # 1. Login to get authentication token
    async with httpx.AsyncClient() as client:
        try:
            login_res = await client.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": "supermarket@freshmart.com", "password": "BusinessPass123!"}
            )
            if login_res.status_code != 200:
                print("Error: Could not login to authenticate requests. Ensure seed.py has been run and backend is running.")
                sys.exit(1)
            token = login_res.json()["data"]["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
        except Exception as e:
            print(f"Error connecting to backend at {BASE_URL}: {str(e)}. Ensure the local backend server is running first.")
            sys.exit(1)

    # 2. Run concurrent requests
    async with httpx.AsyncClient() as client:
        sem = asyncio.Semaphore(concurrency)
        
        async def worker(url, method="GET", json_data=None):
            async with sem:
                return await send_request(client, url, method, json_data, headers)

        # Scenarios mixture:
        # - 40% health requests
        # - 30% inventory search requests
        # - 30% marketplace listings requests
        tasks = []
        for i in range(total_requests):
            if i % 10 < 4:
                tasks.append(worker(f"{BASE_URL}/api/health"))
            elif i % 10 < 7:
                tasks.append(worker(f"{BASE_URL}/api/inventory?search=Milk"))
            else:
                tasks.append(worker(f"{BASE_URL}/api/marketplace/listings"))

        start_time = time.time()
        results = await asyncio.gather(*tasks)
        total_time = time.time() - start_time

    # 3. Compile metrics
    status_codes = [r[0] for r in results]
    latencies = [r[1] for r in results]

    success_count = sum(1 for c in status_codes if c >= 200 and c < 300)
    failed_count = total_requests - success_count

    avg_latency = sum(latencies) / len(latencies)
    sorted_latencies = sorted(latencies)
    p95_latency = sorted_latencies[int(len(sorted_latencies) * 0.95)]
    throughput = total_requests / total_time

    report = f"""# API Load/Stress Test Report

## Parameters
- **Target URL**: {BASE_URL}
- **Concurrency**: {concurrency} active workers
- **Total Requests**: {total_requests}

## Metrics Summary
- **Total Requests Sent**: {total_requests}
- **Successful Requests (2xx)**: {success_count} ({success_count/total_requests*100:.1f}%)
- **Failed Requests**: {failed_count} ({failed_count/total_requests*100:.1f}%)
- **Total Duration**: {total_time:.2f} seconds
- **Throughput (Requests/sec)**: {throughput:.2f} RPS
- **Average Response Time**: {avg_latency*1000:.1f} ms
- **95th Percentile Response Time**: {p95_latency*1000:.1f} ms
"""
    print(report)
    with open("docs/STRESS_TEST_REPORT.md", "w") as f:
        f.write(report)
    print("Report written successfully to docs/STRESS_TEST_REPORT.md")

if __name__ == "__main__":
    asyncio.run(run_load_test(concurrency=20, total_requests=100))

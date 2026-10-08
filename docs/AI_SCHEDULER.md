# AI Background Jobs Scheduler Documentation

This document describes the design, execution, scheduling policies, and environment configurations of the background prediction job scheduler.

---

## 1. Execution Frequencies & Actions

We implement three distinct background routines inside `backend/app/ai/jobs/scheduler.py` managing forecasts, risk levels, and replenishments.

### Daily Job (`daily_prediction_job`)
* **Frequency**: Executed daily at the hour and minute configured via environment variables.
* **Actions**:
  * Loops over all active inventory items in the database.
  * Generates a 14-day daily demand forecast.
  * Calculates multi-factor waste-risk score and risk category.
  * Calculates smart reorder quantities, enforcing suppression if risk is `HIGH` or `CRITICAL`.
  * Preserves results historically in the `ai_predictions` table.
  * Logs status to the `JobLog` database table.

### Weekly Job (`weekly_prediction_job`)
* **Frequency**: Executed weekly on the configured day of week and execution time.
* **Actions**:
  * Generates 4-week forecasts.
  * Examines demand trends and recalculates weekly reorder candidates.
  * Summarizes high-risk products and overstock estimates.

### Monthly Job (`monthly_prediction_job`)
* **Frequency**: Executed monthly on the configured day of month and execution time.
* **Actions**:
  * Generates monthly forecasts.
  * Identifies consistently overstocked/understocked categories and recurring waste patterns.

---

## 2. Scheduler Configuration Environment Variables

The background job trigger schedules are fully configurable in the `.env` file:

```env
# Hour & Minute (0-23 and 0-59) to execute the Daily job (default: 02:00)
AI_DAILY_JOB_HOUR=2
AI_DAILY_JOB_MINUTE=0

# Weekday and time to execute the Weekly job (default: Monday at 03:00)
AI_WEEKLY_JOB_DAY=monday
AI_WEEKLY_JOB_HOUR=3
AI_WEEKLY_JOB_MINUTE=0

# Day of month (1-31) and time to execute the Monthly job (default: 1st of month at 04:00)
AI_MONTHLY_JOB_DAY=1
AI_MONTHLY_JOB_HOUR=4
AI_MONTHLY_JOB_MINUTE=0
```

---

## 3. Production Deployment: Cron Equivalents

If deploying the microservice to an environment where background threads are restricted or external scheduling (system cron) is preferred, disable the APScheduler startup in `main.py` and schedule external calls to `/api/ai/batch-predict` instead.

### Daily Cron (Runs at 02:00 AM)
```cron
0 2 * * * curl -X POST -H "Content-Type: application/json" -d '{"period":"daily"}' http://127.0.0.1:8000/api/ai/batch-predict
```

### Weekly Cron (Runs at 03:00 AM on Monday)
```cron
0 3 * * 1 curl -X POST -H "Content-Type: application/json" -d '{"period":"weekly"}' http://127.0.0.1:8000/api/ai/batch-predict
```

### Monthly Cron (Runs at 04:00 AM on the 1st of every month)
```cron
0 4 1 * * curl -X POST -H "Content-Type: application/json" -d '{"period":"monthly"}' http://127.0.0.1:8000/api/ai/batch-predict
```

---

## 4. Failure and Retry Behavior

The scheduler is engineered to be fault-tolerant:
1. **Per-Item Isolation**: If forecasting or risk evaluation fails for a single product (due to data anomalies), the exception is logged, the failure counter is incremented, and the loop continues to evaluate the remaining products. The run is not aborted.
2. **Status Logging**: Job states are recorded in `JobLog`:
   * `STARTED`: Run initiated.
   * `COMPLETED`: Run succeeded for all items.
   * `PARTIAL`: Run completed, but failed on some products.
   * `FAILED`: The overall job loop crashed before evaluating products.
3. **Robust Database Commits**: Database commits are performed in bulk at the end of the run. In the event of a database conflict, a rollback is executed, and the status is logged as `FAILED` with details.

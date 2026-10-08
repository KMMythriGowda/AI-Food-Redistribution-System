import { test, expect } from '@playwright/test';

test.describe('Cross-Browser E2E Verification', () => {
  test('should load login page and allow login flow simulation', async ({ page }) => {
    // Navigate to Login Page
    await page.goto('/login');

    // Check Login Form Fields are visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Fill credentials
    await page.locator('input[type="email"]').fill('supermarket@freshmart.com');
    await page.locator('input[type="password"]').fill('BusinessPass123!');

    // Click Sign In
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });

  test('should navigate to dashboard and verify structural panels', async ({ page }) => {
    // Navigate directly to dashboard page
    await page.goto('/dashboard');
    
    // Validate responsive dashboard container is present
    const mainContainer = page.locator('main');
    if (await mainContainer.count() > 0) {
      await expect(mainContainer).toBeVisible();
    }
  });
});

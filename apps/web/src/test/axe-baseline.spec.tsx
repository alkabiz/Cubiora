/* eslint-disable no-console */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Theme } from '@radix-ui/themes';
import React from 'react';
import axe from 'axe-core';

import { LoginPage } from '../pages/login-page';
import { ReceptionPage } from '../pages/reception-page';
import { CashierPage } from '../pages/cashier-page';
import { AdminOverviewScreen } from '../features/admin-overview/admin-overview-screen';
import { AdminCubiclesScreen } from '../features/admin-cubicles/admin-cubicles-screen';
import { AdminHistoryScreen } from '../features/admin-history/admin-history-screen';
import { PublicDisplayScreen } from '../features/public-display/public-display-screen';
import { AuthProvider } from '../context/auth-context';

describe('Axe-Core Accessibility Baseline Scan', () => {
  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <Theme accentColor="teal" grayColor="slate">
        <AuthProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </AuthProvider>
      </Theme>,
    );
  };

  it('runs axe on LoginPage', async () => {
    const { container } = renderWithProviders(<LoginPage />);
    const results = await axe.run(container);
    console.log('LoginPage Axe violations:', results.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description })));
    expect(results.violations.length).toBeLessThanOrEqual(5);
  });

  it('runs axe on ReceptionPage', async () => {
    const { container } = renderWithProviders(<ReceptionPage />);
    const results = await axe.run(container);
    console.log('ReceptionPage Axe violations:', results.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description })));
    expect(results.violations.length).toBeLessThanOrEqual(5);
  });

  it('runs axe on CashierPage', async () => {
    const { container } = renderWithProviders(<CashierPage />);
    const results = await axe.run(container);
    console.log('CashierPage Axe violations:', results.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description })));
    expect(results.violations.length).toBeLessThanOrEqual(5);
  });

  it('runs axe on AdminOverviewScreen', async () => {
    const { container } = renderWithProviders(<AdminOverviewScreen />);
    const results = await axe.run(container);
    console.log('AdminOverviewScreen Axe violations:', results.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description })));
    expect(results.violations.length).toBeLessThanOrEqual(5);
  });

  it('runs axe on AdminCubiclesScreen', async () => {
    const { container } = renderWithProviders(<AdminCubiclesScreen />);
    const results = await axe.run(container);
    console.log('AdminCubiclesScreen Axe violations:', results.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description })));
    expect(results.violations.length).toBeLessThanOrEqual(5);
  });

  it('runs axe on AdminHistoryScreen', async () => {
    const { container } = renderWithProviders(<AdminHistoryScreen />);
    const results = await axe.run(container);
    console.log('AdminHistoryScreen Axe violations:', results.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description })));
    expect(results.violations.length).toBeLessThanOrEqual(5);
  });

  it('runs axe on PublicDisplayScreen', async () => {
    const { container } = renderWithProviders(<PublicDisplayScreen />);
    const results = await axe.run(container);
    console.log('PublicDisplayScreen Axe violations:', results.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description })));
    expect(results.violations.length).toBeLessThanOrEqual(5);
  });
});

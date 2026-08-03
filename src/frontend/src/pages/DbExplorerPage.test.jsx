import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DbExplorerPage from './DbExplorerPage';

describe('DbExplorerPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('테이블 목록 및 데이터 정렬이 포함된 화면을 정상적으로 렌더링한다', async () => {
    const mockTables = [{ name: 'accounts', row_count: 5 }];
    const mockSchema = {
      table_name: 'accounts',
      columns: [{ name: 'id', type: 'INTEGER', primary_key: true, nullable: false }],
      foreign_keys: [
        { name: 'fk_accounts_user', constrained_columns: ['user_id'], referred_table: 'users', referred_columns: ['id'] },
      ],
    };
    const mockQueryData = {
      columns: ['id', 'name', 'provider'],
      rows: [[1, 'Main Account', 'Kiwoom']],
      row_count: 1,
      truncated: false,
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v1/system/db/tables')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTables) });
      }
      if (url.includes('/api/v1/system/db/schema/accounts')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSchema) });
      }
      if (url.includes('/api/v1/system/db/query')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQueryData) });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<DbExplorerPage />);

    expect(screen.getByText('DB 탐색기')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('accounts')).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getByText('Main Account')).toBeDefined();
    });

    // 헤더 클릭 정렬 테스트
    const nameHeader = screen.getByText('name');
    fireEvent.click(nameHeader);
  });

  it('스키마 탭 전환 시 컬럼 및 외래 키(FK) 정보를 표시한다', async () => {
    const mockTables = [{ name: 'accounts', row_count: 5 }];
    const mockSchema = {
      table_name: 'accounts',
      columns: [{ name: 'user_id', type: 'INTEGER', primary_key: false, nullable: false }],
      foreign_keys: [
        { name: 'fk_accounts_user', constrained_columns: ['user_id'], referred_table: 'users', referred_columns: ['id'] },
      ],
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v1/system/db/tables')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTables) });
      }
      if (url.includes('/api/v1/system/db/schema')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSchema) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ columns: [], rows: [] }) });
    });

    render(<DbExplorerPage />);

    const schemaTab = screen.getByText('스키마 및 외래키(FK)');
    fireEvent.click(schemaTab);

    await waitFor(() => {
      expect(screen.getByText('외래 키 (Foreign Keys)')).toBeDefined();
      expect(screen.getByText('users')).toBeDefined();
    });
  });

  it('SQL 직접 실행 탭 전환 및 쿼리 실행이 동작한다', async () => {
    const mockTables = [{ name: 'accounts', row_count: 5 }];
    const mockQueryResult = {
      columns: ['name'],
      rows: [['Test Account']],
      row_count: 1,
      truncated: false,
    };

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v1/system/db/tables')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTables) });
      }
      if (url.includes('/api/v1/system/db/schema')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ columns: [], foreign_keys: [] }) });
      }
      if (url.includes('/api/v1/system/db/query')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQueryResult) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<DbExplorerPage />);

    const sqlTab = screen.getByText('SQL 직접 실행');
    fireEvent.click(sqlTab);

    expect(screen.getByText('쿼리 실행')).toBeDefined();

    const textarea = screen.getByPlaceholderText('SELECT * FROM accounts LIMIT 10;');
    fireEvent.change(textarea, { target: { value: 'SELECT name FROM accounts;' } });

    const executeBtn = screen.getByText('쿼리 실행');
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(screen.getByText('Test Account')).toBeDefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { systemService } from './systemService';
import { apiClient } from './apiClient';

describe('systemService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getTaskStatus: 백그라운드 태스크 상태를 조회한다', async () => {
    const mockTasks = { exchange_rate_update: { status: 'running' } };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockTasks);

    const result = await systemService.getTaskStatus();

    expect(getSpy).toHaveBeenCalledWith('/api/v1/system/tasks/status');
    expect(result).toEqual(mockTasks);
  });

  it('getDbTables: DB 테이블 목록을 조회한다', async () => {
    const mockTables = [{ name: 'accounts', row_count: 5 }];
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockTables);

    const result = await systemService.getDbTables();

    expect(getSpy).toHaveBeenCalledWith('/api/v1/system/db/tables');
    expect(result).toEqual(mockTables);
  });

  it('getDbSchema: 특정 테이블의 스키마를 조회한다', async () => {
    const mockSchema = { table_name: 'accounts', columns: [], foreign_keys: [] };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockSchema);

    const result = await systemService.getDbSchema('accounts');

    expect(getSpy).toHaveBeenCalledWith('/api/v1/system/db/schema/accounts');
    expect(result).toEqual(mockSchema);
  });

  it('executeDbQuery: SELECT 쿼리를 실행한다', async () => {
    const mockQueryResult = { columns: ['id', 'name'], rows: [[1, '테스트']], row_count: 1, truncated: false };
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockQueryResult);

    const result = await systemService.executeDbQuery('SELECT * FROM accounts', 100);

    expect(postSpy).toHaveBeenCalledWith('/api/v1/system/db/query', {
      query: 'SELECT * FROM accounts',
      limit: 100,
    });
    expect(result).toEqual(mockQueryResult);
  });

  it('getLogFiles: 시스템 로그 파일 목록을 조회한다', async () => {
    const mockLogFiles = [{ name: 'app.log', size_bytes: 1024, modified_at: '2026-08-17T00:00:00' }];
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockLogFiles);

    const result = await systemService.getLogFiles();

    expect(getSpy).toHaveBeenCalledWith('/api/v1/system/logs/files');
    expect(result).toEqual(mockLogFiles);
  });

  it('getLogContent: 지정한 로그 파일의 내용을 조회한다', async () => {
    const mockLogContent = { filename: 'app.log', total_lines: 10, lines: ['line 1', 'line 2'] };
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockLogContent);

    const result = await systemService.getLogContent('app.log', { lines: 50, level: 'ERROR' });

    expect(getSpy).toHaveBeenCalledWith('/api/v1/system/logs/content', {
      filename: 'app.log',
      lines: 50,
      level: 'ERROR',
    });
    expect(result).toEqual(mockLogContent);
  });
});

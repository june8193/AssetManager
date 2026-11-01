/**
 * 시스템 및 진단 도메인 서비스 모듈
 */
import { apiClient } from './apiClient';

export const systemService = {
  /**
   * 백그라운드 태스크들의 현재 실행/에러 상태를 조회합니다.
   * @returns {Promise<Record<string, any>>}
   */
  getTaskStatus() {
    return apiClient.get('/api/v1/system/tasks/status');
  },

  /**
   * 데이터베이스의 모든 테이블 목록과 레코드 수를 조회합니다.
   * @returns {Promise<Array<{ name: string, row_count: number }>>}
   */
  getDbTables() {
    return apiClient.get('/api/v1/system/db/tables');
  },

  /**
   * 특정 테이블의 상세 스키마 정보를 조회합니다.
   * @param {string} tableName - 테이블 이름
   * @returns {Promise<{ table_name: string, columns: any[], foreign_keys: any[] }>}
   */
  getDbSchema(tableName) {
    return apiClient.get(`/api/v1/system/db/schema/${encodeURIComponent(tableName)}`);
  },

  /**
   * Read-Only SQL 쿼리를 실행합니다.
   * @param {string} query - 실행할 SQL 쿼리문
   * @param {number} [limit=500] - 최대 반환 행 수
   * @returns {Promise<{ columns: string[], rows: any[][], row_count: number, truncated: boolean }>}
   */
  executeDbQuery(query, limit = 500) {
    return apiClient.post('/api/v1/system/db/query', { query, limit });
  },

  /**
   * 서버 로그 디렉터리의 로그 파일 목록을 조회합니다.
   * @returns {Promise<Array<{ name: string, size_bytes: number, modified_at: string }>>}
   */
  getLogFiles() {
    return apiClient.get('/api/v1/system/logs/files');
  },

  /**
   * 지정한 로그 파일의 내용을 조회합니다.
   * @param {string} filename - 로그 파일명
   * @param {{ lines?: number, level?: string, keyword?: string }} [options] - 조회 옵션
   * @returns {Promise<{ filename: string, total_lines: number, lines: string[] }>}
   */
  getLogContent(filename, options = {}) {
    return apiClient.get('/api/v1/system/logs/content', {
      filename,
      ...options,
    });
  },

  /**
   * 시스템 환경 설정(settings.toml)과 원문 및 백업 여부를 조회합니다.
   * @returns {Promise<{ settings: any, raw_toml: string, has_backup: boolean, backup_modified_at?: string }>}
   */
  getSettings() {
    return apiClient.get('/api/v1/system/settings');
  },

  /**
   * 시스템 설정을 저장합니다.
   * @param {{ mode: 'form' | 'raw', settings?: any, raw_toml?: string }} payload - 저장할 설정 데이터
   * @returns {Promise<{ settings: any, raw_toml: string, has_backup: boolean, backup_modified_at?: string }>}
   */
  updateSettings(payload) {
    return apiClient.put('/api/v1/system/settings', payload);
  },

  /**
   * 직전 백업 설정(settings.toml.bak)으로 복원합니다.
   * @returns {Promise<{ settings: any, raw_toml: string, has_backup: boolean, backup_modified_at?: string }>}
   */
  restoreSettings() {
    return apiClient.post('/api/v1/system/settings/restore');
  },

  /**
   * 백엔드 서버 재시작을 요청합니다.
   * @returns {Promise<{ status: string, message: string }>}
   */
  restartServer() {
    return apiClient.post('/api/v1/system/restart');
  },
};

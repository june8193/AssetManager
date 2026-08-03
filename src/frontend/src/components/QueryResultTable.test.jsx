import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QueryResultTable from './QueryResultTable';

describe('QueryResultTable', () => {
  it('컬럼과 데이터를 정상적으로 렌더링하고 헤더 클릭 시 정렬 핸들러를 호출한다', () => {
    const columns = ['id', 'name', 'provider'];
    const rows = [[1, 'Main Account', 'Kiwoom']];
    const onSortMock = vi.fn();

    render(
      <QueryResultTable
        columns={columns}
        rows={rows}
        sortColumn="name"
        sortDirection="ASC"
        onSort={onSortMock}
      />
    );

    expect(screen.getByText('id')).toBeDefined();
    expect(screen.getByText('name')).toBeDefined();
    expect(screen.getByText('provider')).toBeDefined();
    expect(screen.getByText('Main Account')).toBeDefined();

    const nameHeader = screen.getByText('name');
    fireEvent.click(nameHeader);
    expect(onSortMock).toHaveBeenCalledWith('name');
  });

  it('컬럼이 없을 때 안내 메시지를 표시한다', () => {
    render(<QueryResultTable columns={[]} rows={[]} />);
    expect(screen.getByText(/표시할 테이블 데이터가 없습니다/i)).toBeDefined();
  });
});

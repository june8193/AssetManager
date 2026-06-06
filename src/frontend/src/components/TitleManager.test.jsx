import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import TitleManager from './TitleManager';

describe('TitleManager', () => {
  beforeEach(() => {
    document.title = 'Default Title';
  });

  it('대시보드 경로(/)에서 타이틀을 "AssetManager - 대시보드"로 변경한다', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TitleManager />
        <Routes>
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(document.title).toBe('AssetManager - 대시보드');
  });

  it('벤치마크 경로(/benchmark)에서 타이틀을 "AssetManager - 벤치마크 비교"로 변경한다', () => {
    render(
      <MemoryRouter initialEntries={['/benchmark']}>
        <TitleManager />
        <Routes>
          <Route path="/benchmark" element={<div>Benchmark</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(document.title).toBe('AssetManager - 벤치마크 비교');
  });

  it('API 연결 관리 경로(/connection)에서 타이틀을 "AssetManager - API 연결 관리"로 변경한다', () => {
    render(
      <MemoryRouter initialEntries={['/connection']}>
        <TitleManager />
        <Routes>
          <Route path="/connection" element={<div>Connection</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(document.title).toBe('AssetManager - API 연결 관리');
  });

  it('매핑되지 않은 알 수 없는 경로에서는 기본 타이틀인 "AssetManager"로 변경한다', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <TitleManager />
        <Routes>
          <Route path="/unknown" element={<div>Unknown</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(document.title).toBe('AssetManager');
  });
});

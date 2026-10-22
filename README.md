# OSUNNOTE

장문 창작자를 위한 local-first 글쓰기 플랫폼입니다. 반응형 웹과 iOS/Android 앱에서 프로젝트 구성, 집중 집필, 오프라인 작성, 안전한 동기화와 표준 형식 내보내기를 제공하는 것을 목표로 합니다.

현재 상태: Web PWA 알파 구현 진행 중

## 실행

```bash
npm install
npm run dev
```

검증은 `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` 순서로 실행합니다.

## 웹 배포

기본 프로덕션 빌드는 저장소 루트의 `dist/`에 생성되며 Cloudflare Pages에서 바로 배포할 수 있습니다.
Cloudflare의 빌드 명령은 `npm run build`, 출력 디렉터리는 `dist`입니다.

`main` 브랜치에 push하면 GitHub Actions도 검사와 빌드를 수행한 후 GitHub Pages에 배포합니다.
저장소의 **Settings → Pages → Build and deployment → Source**는 `GitHub Actions`로 설정해야 합니다.
배포 주소는 `https://djfjjd.github.io/osunnote/`입니다.

## 현재 구현

- 프로젝트/폴더/문서 탐색과 검색
- Markdown 장문 편집, IndexedDB 자동 저장과 강제 종료 복구
- 문서 상태, 태그, 목표 글자 수, 집중 모드
- 이전 본문 기록과 복원, 휴지통 기반 soft delete
- Markdown/TXT 내보내기와 PWA 오프라인 셸

서버 동기화, 인증, 모바일 앱, DOCX/PDF 내보내기와 구독은 제품 계획의 후속 단계입니다.

## 문서

- [제품 실행계획](docs/PRODUCT_PLAN.md)
- [Codex 작업 지시문](AGENTS.md)

## 개발 시작 조건

`docs/PRODUCT_PLAN.md`의 구현 승인 게이트가 확정되면 기반 구성과 기술 검증부터 시작합니다.

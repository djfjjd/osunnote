# OSUNNOTE Documents·Handwriting 설계안 v0.1

상태: 구현 전 기술 설계
작성일: 2026-11-08

## 1. 범위와 원칙

OSUNNOTE의 기존 Markdown Writer, 메모, 캘린더 데이터와 화면을 유지하면서 다음 두 모듈을 추가한다.

- `Documents`: 블록 기반 문서와 하위 페이지
- `Handwriting`: 벡터 필기 노트와 PDF 주석

두 모듈은 Goodnotes나 Craft의 화면, 명칭, 자산, 고유 상호작용을 복제하지 않는다. 익숙한 편집 관례만 참고하고 OSUNNOTE 디자인 토큰과 정보 구조를 사용한다. AI, 유료 변환 API, GPU 서버는 핵심 기능의 의존성으로 사용하지 않는다.

## 2. 현재 코드와의 차이

현재 `Workspace`는 프로젝트 배열 안에 Markdown 문자열 문서를 중첩하고, IndexedDB의 `workspace/primary` 한 레코드에 전체 상태를 저장한다. 편집기는 React `textarea`이고 저장, 검색, 화면 상태가 `App.tsx`에 모여 있다.

재사용할 수 있는 기반:

- npm workspace와 `@osunnote/domain` 공통 패키지
- 기존 ID, revision, soft delete, 버전 기록 개념
- IndexedDB 순차 저장과 직전 정상본 백업
- 검색, 태그, 집중 모드, 반응형 3단 레이아웃
- Markdown/TXT 다운로드와 PWA 오프라인 셸

추가로 필요한 기반:

- 모듈별 Repository와 IndexedDB object store
- 공통 문서 라이브러리 메타데이터와 엔터티 관계
- 첨부파일/원본 PDF를 위한 Blob 저장소
- 스키마 버전과 재실행 가능한 마이그레이션
- 블록 문서 스키마, 명령, Markdown 변환 계층
- 필기 좌표계, 벡터 명령, 공간 인덱스와 페이지 모델
- 모듈별 검색 문서 생성기와 통합 검색 인덱스
- 대용량 문서와 페이지를 전체 React 상태에 올리지 않는 로딩 구조

## 3. 공통 데이터 모델

세 콘텐츠 형식은 본문을 공유하지 않고 공통 라이브러리에서 메타데이터만 통합한다.

```ts
type LibraryItemKind = "markdown" | "note" | "block-document" | "handwriting";

interface LibraryItem {
  id: string;
  workspaceId: string;
  kind: LibraryItemKind;
  sourceId: string;
  title: string;
  parentId?: string;
  icon?: string;
  coverAssetId?: string;
  pinnedAt?: number;
  archivedAt?: number;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

interface EntityRelation {
  id: string;
  workspaceId: string;
  sourceType: LibraryItemKind | "task" | "event" | "transaction";
  sourceId: string;
  targetType: LibraryItemKind | "task" | "event" | "transaction";
  targetId: string;
  relationType: "link" | "backlink" | "attachment" | "related";
  createdAt: number;
  deletedAt?: number;
}

interface Asset {
  id: string;
  workspaceId: string;
  filename: string;
  mimeType: string;
  byteLength: number;
  checksum: string;
  blob: Blob;
  createdAt: number;
  deletedAt?: number;
}
```

태그는 `Tag`와 `EntityTag`, 검색은 `SearchRecord`로 분리한다. 검색 레코드는 원본이 아니며 언제든 재생성할 수 있는 파생 데이터로 취급한다. 필기 획 자체는 초기 통합 검색 대상이 아니며 노트 제목, 페이지 제목, PDF 텍스트와 사용자가 입력한 메모만 색인한다.

## 4. Documents 데이터 모델

```ts
interface BlockDocument {
  id: string;
  workspaceId: string;
  title: string;
  parentDocumentId?: string;
  templateId?: string;
  schemaVersion: number;
  contentRevision: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

interface BlockDocumentContent {
  documentId: string;
  schemaVersion: number;
  content: unknown; // 검증된 ProseMirror JSON
  plainText: string;
  updatedAt: number;
}

interface BlockDocumentSnapshot {
  id: string;
  documentId: string;
  contentRevision: number;
  content: unknown;
  savedAt: number;
}

interface DocumentTemplate {
  id: string;
  workspaceId?: string;
  name: string;
  description: string;
  schemaVersion: number;
  content: unknown;
}
```

기본 스키마 노드는 `paragraph`, `heading`, `taskList`, `taskItem`, `table`, `tableRow`, `tableCell`, `image`, `callout`, `pageLink`, `text`로 제한한다. 모든 최상위 블록에 안정적인 `blockId`를 부여한다. 하위 페이지는 편집기 JSON 안에 중첩 본문으로 저장하지 않고 별도 `BlockDocument`로 생성하여 `parentDocumentId`와 `pageLink`로 연결한다.

Markdown은 일부 표현력이 블록 문서보다 작으므로 가져오기/내보내기를 별도 어댑터로 둔다. 표, 콜아웃, 하위 페이지처럼 손실 가능성이 있는 변환은 내보내기 전에 경고한다. PDF는 편집기의 저장 형식이 아니라 렌더링 결과다.

## 5. Handwriting 데이터 모델

```ts
type PageTemplate = "blank" | "lined" | "grid" | "pdf";
type DrawingTool = "pen" | "highlighter" | "eraser" | "shape";

interface HandwritingNotebook {
  id: string;
  workspaceId: string;
  title: string;
  coverAssetId?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

interface HandwritingPage {
  id: string;
  notebookId: string;
  orderKey: string;
  width: number;
  height: number;
  template: PageTemplate;
  backgroundAssetId?: string;
  pdfPageIndex?: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

interface InkStroke {
  id: string;
  pageId: string;
  tool: "pen" | "highlighter";
  color: string;
  size: number;
  opacity: number;
  points: StrokePoint[];
  bounds: { x: number; y: number; width: number; height: number };
  createdAt: number;
  deletedAt?: number;
}

interface DrawingShape {
  id: string;
  pageId: string;
  kind: "line" | "rectangle" | "ellipse" | "arrow";
  geometry: unknown;
  style: { color: string; size: number; opacity: number };
  createdAt: number;
  deletedAt?: number;
}
```

좌표는 화면 픽셀이 아니라 페이지 논리 좌표로 저장한다. 확대/회전/기기 해상도와 무관하게 동일한 벡터를 재생할 수 있어야 한다. 실시간 획은 메모리에서 수집하되 `pointerup` 또는 `pointercancel`마다 하나의 append-only 명령으로 커밋한다. 긴 획은 점을 단순화하고 좌표·압력·시간을 delta encoding한 이진 Blob으로 압축할 수 있지만, 첫 버전은 검증 가능한 JSON 점 배열로 시작한다.

지우개는 원본을 파괴하지 않고 획 전체 삭제부터 구현한다. 부분 지우개는 획 분할과 undo 의미가 복잡하므로 별도 단계로 둔다. 페이지 삭제도 soft delete로 처리한다.

PDF 원본은 `Asset`에 그대로 보존한다. PDF.js로 필요한 페이지만 지연 렌더링하고, 필기 좌표는 원본 PDF 페이지 좌표에 정규화한다. 내보낼 때 `pdf-lib`으로 벡터 주석을 원본 위에 합성하며 원본 Blob은 수정하지 않는다.

## 6. 권장 라이브러리

### Documents

| 목적 | 선택 | 이유와 제한 |
|---|---|---|
| 편집기 | Tiptap 3 오픈소스 코어 | React 통합, ProseMirror 스키마/트랜잭션, MIT 코어. Pro/Cloud 기능은 사용하지 않는다. |
| 문서 모델 | ProseMirror JSON | 허용 노드를 스키마로 제한하고 JSON 직렬화·검증 가능 |
| 기본 노드 | Tiptap StarterKit, TaskList, Table, Image | 텍스트·제목·체크리스트·표·이미지의 무료 확장 사용 |
| 콜아웃·페이지 링크 | 자체 Tiptap Node | OSUNNOTE 데이터 관계와 접근성 규칙을 직접 통제 |
| 블록 이동 | ProseMirror transaction + 자체 drag handle | 편집기 내부 순서를 하나의 트랜잭션으로 변경. 페이지 트리/썸네일 정렬에는 dnd-kit 검토 |
| Markdown | 자체 parse/serialize 어댑터 | 지원 노드의 round-trip을 테스트하고 손실 노드를 명시 |
| PDF | 브라우저 print CSS 또는 pdf-lib 기반 exporter | 서버 변환 없이 동작. 한글 글꼴 포함과 페이지 나눔 검증 필요 |

Tiptap 공식 문서는 오픈소스 코어가 MIT이며 ProseMirror 기반임을 명시한다. 기본 표와 체크리스트 확장은 제공되지만, 유료 Pages/Convert 기능을 무심코 도입하지 않도록 의존성 승인 목록을 유지한다.

### Handwriting

| 목적 | 선택 | 이유와 제한 |
|---|---|---|
| 입력 | Web Pointer Events | mouse/touch/pen을 단일 이벤트로 처리하고 pressure, tilt, pointer capture 사용 가능 |
| 자유곡선 | perfect-freehand | MIT, 압력 기반 획 외곽선을 생성. 저장 모델은 라이브러리와 분리 |
| 렌더링 | Canvas 2D + 선택/내보내기용 SVG path | 대량 획 렌더링 성능과 벡터 내보내기를 함께 확보 |
| 공간 탐색 | 자체 bounds 인덱스, 필요 시 RBush 검토 | 지우개·선택의 전체 획 순회를 피함. 새 의존성은 PoC 후 결정 |
| PDF 표시 | Mozilla PDF.js | 브라우저에서 PDF 파싱·페이지 렌더링, Apache-2.0 |
| PDF 합성 | pdf-lib | 브라우저/JavaScript에서 PDF 생성·수정, MIT |

완성형 화이트보드 SDK는 자체 저장 형식과 UI 의존성이 커서 첫 선택에서 제외한다. OSUNNOTE의 페이지 기반 필기 모델과 모바일 렌더러를 장기적으로 통제하는 편이 안전하다.

공식 참고 자료:

- Tiptap: https://tiptap.dev/docs/editor/getting-started/overview
- ProseMirror: https://prosemirror.net/docs/guide/
- dnd-kit: https://dndkit.com/react/quickstart/
- perfect-freehand: https://github.com/steveruizok/perfect-freehand
- Pointer Events: https://developer.mozilla.org/docs/Web/API/Pointer_events
- PDF.js: https://mozilla.github.io/pdf.js/
- pdf-lib: https://github.com/Hopding/pdf-lib

## 7. 기능별 난이도

난이도는 현재 코드 기반에서 한 기능을 데이터·UI·테스트까지 완료하는 상대 평가다.

| 기능 | 난이도 | 주요 위험 |
|---|---|---|
| 블록 텍스트·제목 | 중 | 한글 IME, selection, 자동 저장 |
| 체크리스트·콜아웃 | 중 | 스키마와 Markdown 변환 |
| 표 | 상 | 모바일 조작, 셀 선택, 붙여넣기, PDF 페이지 나눔 |
| 이미지 | 상 | Blob 수명주기, 용량, 방향 정보, 내보내기 |
| 블록 drag & drop | 상 | selection 보존, 접근 가능한 키보드 이동, undo |
| 하위 페이지·템플릿 | 중 | 순환 계층 방지, 복제 시 ID 재발급 |
| 양방향 링크 | 중상 | 링크 rename/delete, 백링크 인덱스 |
| Markdown round-trip | 상 | 표·콜아웃·페이지 링크의 손실 정책 |
| 블록 문서 PDF | 상 | 한글 폰트, 페이지 나눔, 표/이미지 |
| 기본 펜·형광펜 | 상 | 입력 지연, pressure 편차, 고해상도 렌더링 |
| 지우개·선택·도형 | 상 | hit testing, 획 분할, undo/redo |
| 페이지 추가·정렬 | 중 | 대용량 썸네일과 순서 충돌 |
| 템플릿 배경 | 중 | 확대 시 선명도와 인쇄 단위 |
| PDF 불러오기·주석 | 최상 | 좌표 변환, 메모리, 암호화 PDF, 대용량 파일 |
| PDF 벡터 내보내기 | 최상 | 좌표/회전, 투명도, 폰트, 원본 보존 |
| iPad/Android 스타일러스 품질 | 최상 | 예측 입력, palm rejection, 플랫폼별 WebView 차이 |

## 8. IndexedDB와 마이그레이션

기존 `osunnote-local` DB의 `workspace/primary`와 `workspace/backup`을 삭제하거나 형식을 바꾸지 않는다. 다음 DB 버전에서 별도 object store만 추가한다.

```text
libraryItems
blockDocuments
blockContents
blockSnapshots
documentTemplates
notebooks
handwritingPages
inkStrokes
drawingShapes
assets
relations
tags
entityTags
searchRecords
changeOperations
migrations
```

마이그레이션 순서:

1. 기존 primary/backup의 checksum과 문서 수를 기록한다.
2. 새 store를 생성하되 기존 Writer 데이터를 이동하거나 수정하지 않는다.
3. 기존 Writer마다 같은 ID를 참조하는 `LibraryItem(kind="markdown")`만 추가한다.
4. 생성 결과를 원본 ID·제목·문서 수와 대조한다.
5. 검증에 실패하면 새 store 트랜잭션을 abort하고 기존 앱을 연다.
6. 여러 번 실행해도 중복이 생기지 않도록 migration ID와 idempotency key를 사용한다.
7. 백업/복원은 manifest, JSON 레코드, 원본 asset을 묶고 checksum을 검증한다.

Blob 용량 부족은 정상 오류 흐름으로 취급한다. `navigator.storage.estimate()`로 가져오기 전에 여유 공간을 확인하고, 실패 시 부분 생성된 문서와 asset을 같은 트랜잭션에서 제거한다.

## 9. 동기화와 플랫폼 확장

블록 문서와 필기 모두 local-first 명령 로그를 먼저 기록한다.

- 블록: 문서 revision과 ProseMirror transaction에서 만든 도메인 operation
- 필기: `addStroke`, `deleteStroke`, `addShape`, `reorderPage` 같은 append-only operation
- asset: checksum 기반 중복 제거와 별도 업로드 상태

동기화 충돌 시 Writer 본문과 마찬가지로 어느 사본도 자동 폐기하지 않는다. 블록 문서는 자동 병합이 검증되지 않은 경우 충돌 사본을 만들고, 필기 stroke ID가 다르면 합집합을 만들 수 있지만 같은 stroke의 수정 충돌은 두 revision을 보존한다.

웹 Canvas 구현을 모바일에 그대로 강제하지 않는다. 공통으로 공유할 것은 데이터 스키마, 명령, 좌표계, 검색 추출기와 동기화 규약이다. iPadOS/iOS/Android는 React Native Skia 또는 네이티브 펜 렌더러 PoC 후 선택하며 저장된 벡터 포맷은 동일하게 유지한다.

## 10. 개발 순서와 종료 조건

### H0. 저장 기반과 공통 라이브러리

- 기존 데이터 무손실 마이그레이션 하네스
- `LibraryItem`, `Asset`, `Relation`, `SearchRecord`
- 모듈별 Repository와 변경 로그
- 백업/복원 및 저장공간 부족 테스트

종료 조건: 기존 Writer 데이터 checksum 불변, 롤백 가능, 새 빈 모듈 생성·삭제 가능.

### H1. Documents 스키마 PoC

- Tiptap 3 기본 편집기
- paragraph/heading/checklist/callout/pageLink
- JSON 저장, undo/redo, 강제 종료 복구
- Markdown round-trip 속성 테스트
- 한글 IME와 10만 자 성능 측정

종료 조건: 저장/복구와 지원 노드 Markdown 왕복에서 데이터 손실 없음.

### H2. Documents 제품 기능

- 표, 이미지, 블록 drag handle과 키보드 이동
- 하위 페이지, 템플릿, 양방향 링크
- 공통 라이브러리·통합 검색
- PDF 내보내기

종료 조건: 1,000개 블록 문서와 100개 하위 페이지에서 핵심 흐름 안정.

### H3. Handwriting 입력 PoC

- Pointer Events 입력과 pressure 정규화
- pen/highlighter, 색상·굵기, undo/redo
- 줄/모눈/무지 페이지
- 페이지 추가·soft delete·정렬
- 벡터 저장/복구와 10,000획 성능 측정

종료 조건: mouse/touch/Apple Pencil/Android 스타일러스 실제 기기 테스트에서 획 손실 없음.

### H4. Handwriting 도구

- 전체 획 지우개, 선택/이동, 기본 도형
- 공간 인덱스와 화면 밖 획 culling
- 페이지 썸네일과 대용량 노트 로딩
- SVG/이미지 및 자체 백업 내보내기

### H5. PDF 주석

- PDF.js 지연 렌더링과 원본 Asset 보존
- 회전/크롭을 포함한 좌표 변환
- 페이지별 벡터 오버레이
- pdf-lib 기반 주석 병합 내보내기
- 암호화·손상·대용량 PDF 오류 처리

종료 조건: 원본 파일 checksum이 변하지 않고 재내보낸 PDF의 페이지·주석 위치가 일치.

### H6. 통합과 플랫폼

- 전체 검색, 태그, 관련 문서, 일정·할 일 연결
- 모바일 저장소 어댑터와 렌더러 PoC
- 접근성, 키보드, 동적 글자 크기
- Cloudflare asset/operation 동기화 설계 검증

## 11. 권장 첫 구현 단위

첫 구현은 편집기 UI가 아니라 H0의 `LibraryItem` 및 안전한 IndexedDB 스키마 추가와 기존 Writer 참조 마이그레이션으로 한다. 다음으로 Tiptap 스키마 PoC와 Pointer Events 필기 PoC를 서로 독립된 기능 플래그 아래 진행한다. 두 PoC가 기존 `workspace/primary`에 쓰지 않는 것을 자동 테스트로 고정한 뒤 제품 UI에 연결한다.

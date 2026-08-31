# 차 한 잔의 시간 · 변경 이력

> 정리일: 2026-08-31
> 구현 기준: `89a5043` (`Load vessel artwork on demand`)

이 문서는 당시 변경 내용과 구현 범위를 보존하는 개발 이력입니다. 현재 구현 상태와 현재 스펙은 [ROADMAP.md](ROADMAP.md) 및 [DESIGN.md](DESIGN.md)를 기준으로 하며, ROADMAP에는 이 문서의 해당 항목 링크만 둡니다. 상세 설계는 [design-tea-feeling.md](design-tea-feeling.md), [sensory-vocabulary.md](sensory-vocabulary.md), [data-portability.md](data-portability.md)에서 관리합니다.

기존 로드맵의 주요 완료 내역을 옮긴 문서이며 전체 Git 이력을 나열한 것은 아닙니다. 완료일은 기존 로드맵 기준으로 보존하므로 관련 커밋의 작성일과 다를 수 있습니다.

## 문서 변경

### 2026-08-31 — 공지 갱신일 위첨자

[공지사항 설계](design-navigation.md#announcements)에 메뉴명 바로 오른쪽의 `MMDD` 위첨자를 추가했습니다. 앱 배포일이나 예정일이 아닌 공지 묶음의 마지막 내용 갱신일을 사용하며, 열람 후에도 유지합니다. 공지 화면과 접근성 설명에는 연도를 포함한 전체 날짜를 제공하고 별도 읽음 상태는 저장하지 않습니다. 미리보기의 `0831`은 예시 날짜입니다.

미리보기의 한국어 375px 렌더, 번체 320px의 가로 넘침 없음·44px 메뉴 높이, 전체 날짜 안내, 열람·언어 변경 후 날짜 유지와 JavaScript 구문·브라우저 오류 로그·문서 diff를 확인했습니다. 실제 앱 코드·공지 게시·배포는 변경하지 않았습니다.

### 2026-08-31 — 공지사항 메뉴와 업데이트 안내 설계

사용자 요청으로 메뉴의 사용법 위에 스피커 아이콘+공지사항을 추가하는 [설계](design-navigation.md#announcements)를 반영했습니다. 실제 배포된 업데이트와 예정된 업데이트를 구분하고, 제목은 테두리 없이 가운데 정렬·본문은 왼쪽 정렬로 읽습니다. 자동 팝업·푸시 없이 같은 문서에서 읽으며 타이머·초안을 보존하는 방향입니다. 첫 공지에는 UI 개편 뒤 기능 위치와 기존 이미지 유지 여부를 실제 배포 내용에 맞춰 안내합니다.

TW-05에 정적 공지 진입·읽기, TW-06에 번체 공지, TW-08에 배포 내용 일치·기존 설치 업데이트·오프라인 검증을 연결했습니다. 공지 데이터는 앱과 함께 배포하며 별도 서버·CMS를 추가하지 않습니다. 기존 장기 기록·단어장·레시피의 Phase는 유지했습니다.

별도 미리보기에서 공지 메뉴·본문 펼침·타이머 복귀, 한국어 375px 렌더, 번체 320px의 제목 정렬·44px 이상 조작 영역·가로 넘침 없음, TW 단계의 공지사항/사용법/설정 노출, 공지 읽기 후 메모와 음소거 상태 유지를 확인했습니다. JavaScript 구문·브라우저 오류 로그·문서 링크·diff도 확인했습니다. 예시 공지와 설계만 변경했으며 실제 공지 게시·앱 런타임·자산·SW·배포 변경은 없습니다.

### 2026-08-31 — 느낌 시트 저장 버튼 문구

사용자 요청에 따라 장기 기록 버튼을 `모바일 기기 아이콘 + 브라우저 기록으로 남기기`, 초안 유지·닫기 버튼을 `임시저장`으로 정했습니다. [차 느낌](design-tea-feeling.md#draft-policy)·[배치 설계](design-navigation.md)의 문구와 아이콘 기준, DESIGN·ROADMAP·데이터 보존 문서의 연결 표현을 맞췄습니다. 임시저장은 현재 세션 메모리에 유지하는 기존 의미이며, 버튼 근처에 `임시저장은 이번 우림 동안만 유지됩니다.`를 표시합니다. 브라우저 기록 저장은 방문 기록·동기화가 아닌 앱의 로컬 기록이며 Phase B 구현 대기입니다.

별도 미리보기의 375px 렌더에서 문구·스마트폰 아이콘을 확인하고, 320px에서 가로 넘침 없음·44px 이상 버튼 높이·임시저장 후 입력 유지·기록 저장 예시 후 기록함 링크를 확인했습니다. JavaScript 구문·브라우저 오류 로그·문서 diff를 확인했습니다. 실제 앱의 저장 기능·코드·이미지 자산·SW는 변경하지 않았습니다.

### 2026-08-31 — 2단계 메뉴의 테두리 제거·가운데 정렬

사용자 검토를 반영해 [배치 설계 §2.1](design-navigation.md)에 사용법·설정 등 하위 메뉴 행의 테두리를 없애고 메뉴명을 가운데 정렬하는 기준을 추가했습니다. 아이콘 유무와 관계없이 텍스트 중심을 맞추고, 전역 메뉴·입력창·주요 실행 버튼은 기존 형태를 유지합니다. 터치 영역과 키보드 포커스 표시는 제거하지 않습니다.

별도 미리보기의 한국어 375px 렌더와 번체 320px 사용법·설정 행을 확인했습니다. 메뉴 행은 테두리 0px·가운데 정렬·높이 44px이며, 사용법 텍스트 중심 오차와 가로 넘침이 없었습니다. 브라우저 오류 로그·JavaScript 구문·문서 diff를 확인했으며 실제 앱 런타임 변경은 없습니다.

### 2026-08-31 — 후속 기능 배치와 아이콘·문구 기준

[화면 배치와 메뉴 표현](design-navigation.md)을 추가하고 DESIGN·ROADMAP·다국어·차 느낌·단어장·TW 실행 계획을 연결했습니다. 메인 우상단의 언어 선택+메뉴, 기록함·단어장·레시피의 단계별 메뉴 진입, 느낌 작성 중 단어장, 기록함 안 회고, 설정의 전체 백업·복원을 배치했습니다. 목적지는 아이콘+이름, 결과가 중요한 행동은 문구, 맥락이 분명한 작은 조작은 아이콘만 쓰는 기준도 정했습니다.

기존 설정 전용 언어 선택은 메인의 명시적 전환으로 확장했습니다. 같은 문서의 전환은 우림 상태를 보존하고, 별도 도움말·설정 문서로 나가는 동작은 계속 보호합니다. 첫 저장 후에만 기록 진입점을 노출하거나 홈에 개수 배지를 추가하는 제안은 채택하지 않았습니다. 기능 도입 후에는 빈 기록함도 메뉴에서 접근하며 첫 저장 성공 뒤 맥락 링크를 제공합니다.

별도 배치 미리보기에서 TW/후속 단계 메뉴 노출, 320px·375px 폭, 한국어·번체 상단 조작의 44px 높이와 가로 넘침, 느낌→단어장→느낌의 메모·포커스 보존, 언어 전환 뒤 메모·태그 유지, 명시적 저장 뒤 기록함 링크, 설정→백업 진입, Escape 닫기·포커스 복귀를 확인했습니다. 미리보기의 JavaScript 구문 검사와 브라우저 오류 로그, 문서 로컬 링크·앵커 및 diff를 확인했습니다. 화면 캡처는 초기 한국어 배치를 확인했으며, 일부 상호작용 후 캡처가 빈 이미지로 반환되어 그 상태의 시각 검증은 DOM 경계 확인과 구분합니다.

이는 배치 예시와 문서 검증이며 실제 타이머·영구 저장·전체 번역·스크린리더·모바일 PWA의 통과 결과가 아닙니다. TW-05에는 언어 선택·기본 메뉴만 포함하고 후속 기능의 Phase는 유지합니다. 런타임·SW·푸시·배포 변경은 없습니다.

### 2026-08-31 — TW 착수 전 동작 계약과 개발 흐름

[AGENTS.md](../AGENTS.md)에 통합 브랜치 `codex/tw-readiness` → TW별 기능 브랜치 → 설계·구현·검증 → 순차 병합 흐름과 문서 역할을 정리했습니다. 기존 대만 우선순위 문서와 [실행 계획](tw-implementation-plan.md)을 공통 기준점으로 함께 관리합니다.

[DESIGN §6.5](DESIGN.md), [차 느낌](design-tea-feeling.md#draft-policy), [설정 보존](data-portability.md#preferences-contract), 새 [다국어 설계](design-localization.md)에 구현 계약을 반영했습니다. 상시 느낌 진입·초안이 있을 때 선택 잠금·명시적 종료, 완료 0포 표현, 조기 출탕 시간과 중복 완료 방지, v1 부분 저장·ID 별칭·빈 태그 보존, 한국어 기본값과 대만 번체 선택·안전한 페이지 이동, 기존 제품명 유지가 대상입니다.

검증은 현재 코드 대조와 문서 일관성·로컬 링크·diff 확인입니다. 데이터 fixture와 타이머 경계·언어·기기 시나리오는 실행할 완료 조건으로 정의했으며 아직 통과 결과가 아닙니다. TW-01–08은 모두 구현 대기이고 런타임·SW 캐시·배포 변경은 없습니다. 다음 구현 항목은 TW-01입니다.

### 2026-08-31 — 대만 실사용 우선 처리 묶음 추가

대만에서 약 3개월간 중국어를 공부하고 사람들과 차를 마시는 실사용을 위해, [현재 우선 처리](ROADMAP.md#taiwan-priority)를 추가했습니다. Phase A의 태그 보존·시트 접근성·초안 경계·즉시 출탕과 Phase D-1의 번체 중국어 지원을 TW-01–08로 묶고, 주분류·완료 확인·선행 결정·제외 범위를 적었습니다.

기존 A 전체→B→C→D 순서에서 번체 지원만 A 핵심 안정화와 함께 앞당깁니다. 영어·간체·일본어는 D-2로 남기고, 백그라운드 완료 신호 예약은 별도 검증합니다. 감각 연출·스와이프·전체 폰트 셀프호스팅과 장기 기록·백업은 이번 묶음의 선행 조건이 아닙니다. 카테고리 정의와 기존 완료 내역은 유지했으며, 기능 구현·완료·배포를 뜻하는 변경은 아닙니다.

### 2026-08-31 — 개발 카테고리 정의와 완료 내역 분리

기존 날짜순 표의 완료 항목 12개에 주분류를 부여해 6개 주분류(우림 감각·다구 표현, 조작·세션 흐름, UI·화면 구조·내비게이션, 차 느낌·감각 확장, 성능·PWA·오디오, 도움말·설정·언어)로 색인했습니다. 데이터 보존·이동성은 독립 완료 항목이 아직 없어 완료 색인에서는 생략했습니다.

분류 기준은 다음과 같이 정리했습니다. `우림 상태의 감각 표현`·`차 선택의 시각 단서`는 우림 감각·다구 표현으로, `짧은 조작의 편의`는 조작·세션 흐름으로 옮겼습니다(제스처·배치는 UI 책임). `접근성과 피드백 중복성`은 UI 기준이자 모든 카테고리에 공통인 품질 기준으로 두고, 신호 표현은 우림 감각에 둡니다. `설치형 앱 완성도`는 성능·PWA·오디오로, `한 잔의 감각 기록`은 차 느낌·감각 확장과 데이터 보존·이동성으로 분리했습니다. 도움말·설정·언어는 기존 완료 내역과 다국어 계획의 공통 책임으로, UI는 아이콘·탭·메인 역할 등 확장 전 화면 구조 설계의 책임으로 명시했습니다.

변경 이유는 앱 철학을 책임 범위와 연결하고, 기능 확장 때 생기는 UI·데이터·기록의 경계 혼동을 줄이며, 로드맵에서 전체 진행 상황을 쉽게 훑을 수 있게 하기 위해서입니다. Phase·완료일·구현 상태와 기존 12개 항목의 구현 범위는 유지했습니다. 런타임 변경은 없습니다.

## 2026-08-01

<a id="asset-loading"></a>

### 다구 이미지 on-demand와 오디오 잔여음 정리

분류: 성능·PWA·오디오

평상시 선택 다구의 SVG `href`만 유지하고 전환 대상은 `Image.decode()`와 실제 SVG load 뒤 교체했습니다. 새 화면 페인트 후 이전 `href`를 제거했습니다. 폰트를 기다리지 않고 시작 자산과 UI를 초기화하며 음소거·초기화 시 활성 oscillator를 정지했습니다. SW 캐시 v57을 적용했습니다.

관련 커밋: [`89a5043`](https://github.com/winterrainlee/tea-timer/commit/89a5043) (`Load vessel artwork on demand`)

<a id="rendering-cache"></a>

### 모바일 렌더·PWA 캐시 최적화

분류: 성능·PWA·오디오

상태 기반 단일 스케줄러, 진행 중 30fps·완료 대기 12fps, idle·배수 완료 정지, reduced-motion 정적 렌더, 김 노드 재사용을 적용했습니다. 문서 network-first와 정적 자산 cache-first를 shell/static 캐시로 분리했습니다.

관련 커밋: [`aefbfa4`](https://github.com/winterrainlee/tea-timer/commit/aefbfa4) (`Reduce mobile rendering and cache overhead`)

## 2026-07-28

<a id="small-screen-safari"></a>

### 작은 화면·Safari PWA 안정화

분류: UI·화면 구조·내비게이션

iPhone Mini급 레이아웃 붕괴와 설정 입력 폭을 교정하고, 카드 PNG는 Web Share 파일 공유를 우선한 뒤 다운로드로 폴백하도록 보강했습니다.

관련 커밋: [`733c8ca`](https://github.com/winterrainlee/tea-timer/commit/733c8ca) (`fix: improve PWA layout and settings guidance`), [`1745c51`](https://github.com/winterrainlee/tea-timer/commit/1745c51) (`fix: share card images in Safari`), [`48ca7b6`](https://github.com/winterrainlee/tea-timer/commit/48ca7b6) (iPhone 13 mini 여백 붕괴 수정), [`e67b5e0`](https://github.com/winterrainlee/tea-timer/commit/e67b5e0) (설정 입력 폭·터치 영역 수정)

<a id="feeling-mvp"></a>

### `[이번 차의 느낌]` MVP

분류: 차 느낌·감각 확장

현재 세션 요약, 기본·커스텀 태그, 제목·자유 문장, 세션 초안, 텍스트 복사, 680×900 Canvas 카드 공유·다운로드를 구현했습니다. `help.html`과 `settings.html` 역할을 분리했습니다. 영구 기록 저장은 별도 미완료 범위입니다.

관련 커밋: [`6bbaa93`](https://github.com/winterrainlee/tea-timer/commit/6bbaa93) (`feat: [차 느낌] 시음 카드 바텀시트 모달 및 help.html 3대 섹션 개인설정 통합 구현`), [`78e6174`](https://github.com/winterrainlee/tea-timer/commit/78e6174) (사용법·개인설정 페이지 분리)

<a id="session-draining"></a>

### 세션 보호와 모든 다구 출탕 단계

분류: 조작·세션 흐름

1포 이상 완료 후 차·다구 변경을 `우림 끝`까지 잠그고, 일반 다구와 표일배 모두 우림 완료 뒤 실제 따라내기·배수 단계를 거쳐 다음 포로 이동하도록 했습니다.

관련 커밋: [`97f005d`](https://github.com/winterrainlee/tea-timer/commit/97f005d) (`feat: 우림 세션 보호(Session Lock) 구현`), [`33f5fd6`](https://github.com/winterrainlee/tea-timer/commit/33f5fd6) (`feat: 모든 다구 우림 완료 후 따라내기(出湯) 단계 및 기물별 시각화 구현`)

## 2026-07-17

<a id="ios-audio"></a>

### iOS 오디오 인터럽션 복구

분류: 성능·PWA·오디오

`AudioContext`가 `suspended`뿐 아니라 `interrupted` 등 모든 non-running 상태일 때 재개하고, `closed`면 재생성하도록 했습니다. 앱 복귀·다음 포 시작·매 재생 직전에 복구하며, `sw.js` 캐시를 v49로 갱신했습니다. 백그라운드 완료 신호 선예약은 별도 미완료 항목입니다.

관련 커밋: [`516146b`](https://github.com/winterrainlee/tea-timer/commit/516146b) (`Restore tea timer audio after iOS interruptions`)

## 2026-07-12

<a id="feeling-entry"></a>

### `[이번 차의 느낌]` 선행 정리

분류: UI·화면 구조·내비게이션

메인 화면 푸터의 응원 박수(👏)·모달·제작자 반응 전송 코드를 제거하고 도움말의 박수만 유지했습니다. 그 자리에 음소거 버튼과 같은 실루엣의 연필 라인 아이콘 노트 버튼과 당시 `준비 중` 안내 모달을 추가했습니다. 상세 설계는 [design-tea-feeling.md](design-tea-feeling.md) §7을 따릅니다.

관련 커밋: [`edce834`](https://github.com/winterrainlee/tea-timer/commit/edce834) (`Extract tea-feeling design doc and seed footer note button`)

<a id="help-tone"></a>

### 도움말 톤 정리

분류: 도움말·설정·언어

`help.html` 전체를 정중한 합니다체로 통일했습니다(해요체는 과하게 친근해 배제, 요청문만 `-해 주세요`). 앱 소개 섹션을 추가하고, 사용법에 권장 눈금·泡 설명을 반영했습니다. 포크/오픈소스 문구를 사용자 관점(`자유롭게 쓰세요`)으로 재작성하고, 기억한 설정에 "이 기기에만 저장"을 명시했으며, 박수 모달 `싫어요`→`괜찮습니다` 등 문구를 순화했습니다.

관련 커밋: [`1a4783f`](https://github.com/winterrainlee/tea-timer/commit/1a4783f) (`Switch help copy from haeyo to hamnida register`), [`18b1ddb`](https://github.com/winterrainlee/tea-timer/commit/18b1ddb) (`Soften help page tone for tea beginners`)

<a id="preferences"></a>

### 반복 사용 상태 영속

분류: 조작·세션 흐름

`teaTimer.preferences.v1`에 차·다구·차별 권장 대비 보정값(델타)·음소거를 저장·복원했습니다. 슬라이더 권장 지점 눈금(금색 채움 위에서도 식별되도록 어두운 테두리), `aria-valuetext`로 권장 시간 병기, 도움말 `기억한 설정 지우기`, 우림 중 `−`/`+` 비활성화를 적용했습니다. 상세 스펙은 [DESIGN.md](DESIGN.md) §6.2를 따릅니다.

관련 커밋: [`8b25b4b`](https://github.com/winterrainlee/tea-timer/commit/8b25b4b) (`Persist repeated-use preferences as per-tea deltas`)

## 2026-06-28

<a id="tea-visuals"></a>

### 우림 시각 표현 보강

분류: 우림 감각·다구 표현

개완·표일배의 김 배출 위치를 뚜껑과 림 사이 틈으로 교정하고, 7종 차의 젖은 잎 형태를 분리했으며, 유리 다구의 찻잎을 idle부터 표시했습니다.

관련 커밋: [`3c9508c`](https://github.com/winterrainlee/tea-timer/commit/3c9508c) (`Fix steam emission positions for gaiwan and piaoyibei`), [`684428e`](https://github.com/winterrainlee/tea-timer/commit/684428e) (`Differentiate wet leaf shapes per tea type`), [`892541e`](https://github.com/winterrainlee/tea-timer/commit/892541e) (`Show tea leaves from the start of brewing`)

<a id="separator-liquid"></a>

### 표일배 액체·찻잎 위치 교정

분류: 우림 감각·다구 표현

윗 챔버의 배수구 위로 찻잎과 액체 하단을 올려 거름망 안에서 우러나는 물리적 구조에 맞췄습니다.

관련 커밋: [`b82ef6d`](https://github.com/winterrainlee/tea-timer/commit/b82ef6d) (`Fix piaoyibei leaf and liquid positions above drain spout`)

## 2026-06-18

<a id="reactions"></a>

### 도움말 제작자 반응 집계

분류: 도움말·설정·언어

`help.html`의 박수/괜찮습니다 모달에서 앱·반응값만 Cloudflare Worker로 보내고 D1에 집계했습니다. 허용 Origin과 입력값 검증, Bearer 토큰 기반 비공개 합계 API, 실패 시 사용자 흐름을 막지 않는 전송 방식을 적용했습니다.

관련 커밋: [`82a0260`](https://github.com/winterrainlee/tea-timer/commit/82a0260) (`Add creator reaction tracking`), [`9be2e88`](https://github.com/winterrainlee/tea-timer/commit/9be2e88) (`Document applause privacy note`), [`4c8bb07`](https://github.com/winterrainlee/tea-timer/commit/4c8bb07) (`Add applause button to help page`)

# 사용자 데이터와 이동성 — 설계 원칙

> 기준일: 2026-08-31
> 제품 방향 출처: `dd98847` (`Refine product roadmap and user data philosophy`)
> 상태: **개념 설계**
> 문서 역할: local-first 저장, File over app, 공개 스키마, 백업·복원에 관한 제품·데이터 원칙을 정의한다.
> 관련 문서: [DESIGN.md](DESIGN.md), [design-tea-feeling.md](design-tea-feeling.md), [sensory-vocabulary.md](sensory-vocabulary.md)

현재 구현은 `teaTimer.preferences.v1`의 설정·커스텀 태그, 메모리 한정 세션 초안, 일반 텍스트 복사와 PNG export까지다. 이 문서의 IndexedDB 저장, 초안 자동 보호, JSON/Markdown 이동, 백업·복원과 공개 스키마는 모두 후속 설계다. 커스텀 태그 저장 시 덮어쓰기 결함은 [ROADMAP.md](ROADMAP.md)의 선행 안정화 항목으로 남긴다.

---

## 1. 목적

`차 한 잔의 시간`은 사용자를 앱 안에 묶어 두지 않는다.

앱을 쓰며 사용자가 직접 만들어낸 기록과 표현은 앱보다 오래 살아야 한다.

핵심 원칙:

> **재생성할 수 없는 것은 반드시 내보낼 수 있어야 한다.**

앱은 사용자의 차 생활 전체를 관리하는 서비스가 아니다. 전문적인 관리가 필요해지면 사용자는 더 적합한 앱이나 노트 도구로 옮겨갈 수 있어야 한다. `차 한 잔의 시간`은 그 이동을 막지 않고, 차를 우릴 때 필요한 작은 도구로 계속 남을 수 있다.

---

## 2. File over app 해석

이 프로젝트에서 File over app은 "모든 것을 파일로 저장한다"는 뜻이 아니다.

질문은 다음과 같다.

> 앱을 사용하면서 생긴 것 중 무엇이 앱보다 오래 살아야 하는가?

브라우저 내부에서는 사용성에 맞는 저장소를 써도 된다. IndexedDB는 앱이 사용자 자산을 빠르게 읽고 쓰기 위한 로컬 저장소다. 중요한 것은 그 데이터가 IndexedDB에만 갇히지 않는 것이다.

```text
앱 사용
  ↓
IndexedDB
  ↓
사용자 자산
  ├─ JSON 백업/복원
  ├─ Markdown 보관
  └─ 공개 스키마를 통한 다른 도구와의 이동
```

---

## 3. 데이터 구분

### 3.1 앱 자산

다시 내려받거나 재생성할 수 있는 것.

- 기본 차 프리셋
- 기본 다구 정의
- 공식 풍미 분류
- 앱 기본 단어장
- UI 번역 문자열
- 기본 권장 시간과 온도

앱 자산은 사용자 백업의 핵심 대상이 아니다.

### 3.2 사용자 자산

사용자가 직접 경험하며 만든 것.

- 시음 세션
- 개인 감각 단어장
- 개인 레시피
- 사용자 작성 메모
- 커스텀 태그
- 사용자가 수정한 차 이름 등 세션별 사용자 표현

사용자 자산은 반드시 백업·복원 대상이다.

특히 개인 감각 단어장은 1급 사용자 자산(first-class user data)으로 취급한다. 시음 기록은 당시의 느낌을 완전히 재생하지 못할 수 있지만, 사용자가 새로 획득한 감각 좌표는 이후의 경험에서도 계속 사용할 수 있기 때문이다.

---

## 4. 저장 위치

### 4.1 가벼운 설정

현재처럼 `localStorage`를 사용한다.

예:

- 마지막 선택 차
- 마지막 선택 다구
- 차별 권장 대비 시간 보정
- 음소거

이 데이터는 편의를 위한 설정이며, 없어져도 사용자가 만든 경험 자체가 사라지는 것은 아니다.

단, 현재 같은 설정 키에 들어 있는 `customTags`는 사용자 자산이다. 저장 위치가 설정 안이라는 이유로 선택적 백업에서 빠지면 안 된다. 향후 저장 위치·마이그레이션은 별도로 정하되 기존 태그를 보존한다.

### 4.2 장기 사용자 자산

IndexedDB를 기본 후보로 한다.

```text
IndexedDB
├─ sessions
├─ vocabulary
└─ recipes       # later
```

- 서버 운영이 필요 없다.
- 사용자 기기 안에서 동작한다.
- 구조화된 여러 기록을 localStorage보다 안정적으로 다룰 수 있다.
- IndexedDB 자체를 최종 보관 포맷으로 간주하지 않는다.

서버나 중앙 계정은 필수로 두지 않는다.

현재 도움말의 Worker/D1 박수·반응 집계는 사용자 시음 기록을 저장하는 중앙 DB가 아니며, 이 장기 기록 설계와 별개다.

---

## 5. 기록 의사와 자동 저장의 경계

타이머를 사용했다는 이유만으로 모든 세션을 장기 기록으로 저장하지 않는다.

> **타이머 사용 ≠ 기록 의사**

반면 사용자가 `[이번 차의 느낌]`에서 태그나 메모를 남기기 시작했다면, 작성 중 내용이 사라지지 않도록 세션 초안을 로컬에서 자동 보존할 수 있다.

권장 구조:

```text
타이머만 사용
→ 장기 기록 없음

느낌 입력 시작
→ 현재 세션 draft 자동 보존

사용자가 '기기에 남기기'
→ IndexedDB Tea Session으로 확정
```

사용자가 표현을 했는데 저장 버튼을 누르지 않아 날아가는 경험은 피한다. 동시에 기록하지 않으려던 차가 자동으로 기록함을 채우는 것도 피한다.

이는 앞으로의 보호 원칙이다. 현재 초안은 새로고침·앱 재실행·`우림 끝`으로 사라진다. 초안 저장소, 복구 시점, 세션 종료·차/다구 변경 시의 유지·폐기 경계는 구현 전에 확정한다.

---

## 6. 전체 백업

하나의 전체 백업 파일에 사용자 자산을 함께 담는다.

개념 예시:

```text
TimeForTeaBackup
├─ version
├─ exportedAt
├─ sessions[]
├─ vocabulary[]
├─ recipes[]
├─ customTags[]     # 설정과 별개로 사용자 자산에 포함
└─ preferences?     # 선택
```

전체 백업의 기본 포맷은 JSON을 우선한다.

복원 시에는 버전 검증과 마이그레이션 가능성을 고려한다. 손상된 일부 데이터가 전체 타이머 사용을 막아서는 안 된다.

### 6.1 보관·삭제와 회고의 분리

열 잔은 회고를 발견하는 시점이지 저장 상한이 아니다. 기존 `teaTimer.cups.v1` 최근 10장·초과 자동 삭제안은 현행 계획에서 제외한다. 이 저장소는 실제 구현된 적이 없으므로 해당 키의 데이터 마이그레이션을 전제하지 않는다.

무제한 보관을 확정한 것은 아니다. 브라우저 저장 공간의 제약, 사용자가 지우는 범위, 백업 안내, 복원 중 중복·충돌 처리는 별도 정책으로 정한다. 회고를 열었다는 이유로 이전 기록을 자동 삭제하지 않는다.

---

## 7. 개별 이동

각 사용자 자산은 독립적으로도 이동할 수 있어야 한다.

- Tea Session → JSON / Markdown
- Sensory Vocabulary → JSON / Markdown
- Brewing Recipe → JSON / Markdown (later)

### JSON

- 앱 간 데이터 이동
- 전체 복원
- 구조화된 자동 처리
- 공개 스키마 검증

### Markdown

- 사람이 직접 읽을 수 있음
- 장기 보관이 쉬움
- Obsidian, Git, 일반 텍스트 편집기 등에서 앱 없이도 접근 가능
- 특정 앱이 사라져도 기록의 의미가 남음

카드 PNG나 Plain Text 복사는 공유·빠른 이동을 위한 보조 출력으로 계속 사용할 수 있다.

---

## 8. 공개 스키마 원칙

스키마는 앱 내부 구현값이 아니라 **차 한 잔의 경험 자체**를 표현해야 한다.

피해야 할 예:

```text
teaTimerVesselIndex: 3
uiCardColor: gold
selectedCarouselPage: 2
```

지향할 예:

```text
tea
vessel
brewingMethod
separationMethod
infusions
sensoryNotes
leafAmount
waterVolume
waterTemperature
```

앱이 실제로 관찰한 것, 사용자가 직접 보고한 것, 앱이 추천했을 뿐인 것을 섞지 않는다.

```text
observed
→ 앱이 실제 사용 과정에서 알게 된 것
→ 다구, 포수, 포별 실행 시간 등

reported
→ 사용자가 직접 입력한 것
→ 감각 태그, 메모, 실제 수온, 찻잎 g 등

recommended
→ 앱이 제안한 것
→ 권장 시간, 권장 온도
```

예를 들어 권장 온도를 실제 사용 온도로 기록해서는 안 된다.

앱이 아는 다구는 사용자가 화면에서 선택한 다구이고 실행 시간은 타이머가 진행한 시간이다. 실제 사용한 기물·물리적 우림 시간·온도를 센서로 측정했다는 뜻이 아니다. 사용자가 보고한 값 및 권장값과 구분해 저장하고 표시한다.

---

## 9. 공개 스키마 후보

실제 JSON Schema 파일은 데이터 모델이 충분히 안정된 뒤 만든다. 지금은 이름과 책임 범위만 잡는다.

### Tea Session Schema v1

한 번의 차 우림 세션을 표현한다.

후보 필드:

- id
- createdAt
- tea
- vessel
- brewingMethod / separationMethod
- infusions[]
- sensoryTags[]
- note
- optional: leafGrams
- optional: waterMl
- optional: waterTemperature

### Sensory Vocabulary Schema v1

개인 감각 단어를 표현한다.

후보 필드:

- id
- label
- categoryId / parentId
- note
- createdAt
- source: personal

### Brewing Recipe Schema v1

충분한 사용 경험 뒤 레시피북을 구현할 때 정의한다.

후보 필드:

- tea reference / user label
- vessel / brewing method
- infusion sequence
- optional amounts / temperature
- user note

스키마 이름과 작성자 정보에는 프로젝트의 출처를 명확히 남긴다. 앱 자체보다 포맷이 오래 살아남을 가능성도 고려한다.

---

## 10. 다국어와 canonical ID

표시 문자열과 저장 ID를 분리한다.

예:

```text
tea id: oolong.light
vessel id: gaiwan
sensory id: floral.gardenia
```

표시는 locale에 따라 바뀔 수 있다.

```text
floral.gardenia
ko       치자
zh-Hant  梔子花
zh-Hans  栀子花
ja       クチナシ
en       Gardenia
```

사용자가 직접 만든 개인 단어와 메모는 원문을 보존한다. 자동 번역으로 원본을 덮어쓰지 않는다.

---

## 11. Import 원칙

Import는 Tea Timer가 내보낸 파일만 받는 폐쇄형 복원 기능으로 만들지 않는다.

공개 스키마에 맞는 외부 데이터라면 다른 도구가 만든 기록도 가져올 수 있는 방향을 지향한다.

```text
Tea Timer export
        ┐
외부 호환 도구 export
        ├─ schema validation → import
직접 작성한 호환 JSON
        ┘
```

단, MVP에서는 안전한 자체 백업 복원부터 시작하고, 외부 호환 import는 스키마가 안정된 뒤 연다.

---

## 12. 비목표

- 필수 회원가입
- 중앙 사용자 DB
- 클라우드 동기화를 프로젝트의 기본 책임으로 삼기
- 사용자 데이터를 서비스 안에 붙잡기
- 전문 차 재고·구매·가격 관리
- 모든 외부 차 앱 포맷을 직접 지원하기
- 앱이 없어지면 읽을 수 없는 독점 포맷만 제공하기

전문 관리 기능이 필요해진 사용자는 데이터를 가지고 더 적합한 도구로 이동할 수 있어야 한다.

그 뒤에도 차를 우릴 때 `차 한 잔의 시간`의 타이머만 계속 사용할 수 있다.

# CLAUDE.md

차 우림 타이머 **차 한 잔의 시간 · Time for Tea** 작업 시 참고. 전체 설계 근거는 [DESIGN.md](DESIGN.md), 실행법은 [README.md](README.md). 이 파일은 **코드 지도 + 운영상 함정 + 현황**만 담는다.

## 무엇인가
끓는 물을 부은 뒤 수십 초 동안 "지금 따라낼 때"를 시각·청각·화면으로 깨닫게 하는 모바일 PWA 타이머. **빌드 없음**: `index.html`(바닐라 JS + PNG 도구 자산 + 인라인 SVG 효과 + WebAudio 합성음) + `assets/vessels/*.png` + `manifest.webmanifest` + `sw.js`.

## ⚠️ 개발 함정 (먼저 읽기)
- **서비스워커가 cache-first**(`sw.js`) → `index.html` 수정 후 그냥 새로고침하면 **옛 버전이 캐시에서 뜬다**. 반드시 SW 등록 해제 + 캐시 삭제 후 리로드:
  ```js
  (async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const k of await caches.keys())await caches.delete(k);location.reload();})()
  ```
- **헤드리스 미리보기는 비활성 시 `requestAnimationFrame`을 멈춘다** → eval만으로 시간 진행을 보면 우림이 pour/steep에서 멈춘 듯 보인다(버그 아님). 카운트다운·애니메이션 검증은 **스크린샷으로 페인트를 유발**하거나 실제 브라우저에서 한다. 정적 스타일/레이아웃은 eval로 DOM을 직접 바꿔 스크린샷으로 확인.
- **소리·Wake Lock·서비스워커는 `http(s)`에서만** 동작(`file://` 불가). 로컬은 `python3 -m http.server 8123`(설정: [.claude/launch.json](.claude/launch.json); 4173은 점유돼 있어 8123 사용).
- 오디오는 첫 사용자 제스처(`ensureAudio`)에서 언락. 음소거는 `muted` 플래그.

## 코드 지도 (`index.html` 안)
- **데이터**: `TEAS[]`(7종: 녹차·백차·청향우롱·생보이·농향우롱·홍차·숙보이, 각 `light/strong` RGB·`base`·`add`·`peak`·`temp`), `VESSELS[]`(5종), `VICONS`(세그먼트 미니 아이콘).
- **상태 머신**: `idle → pour → steep → done`. 핵심 함수: `startBrew → enterSteep → finishSteep`, 매 프레임 `frame()` → `render()`. 회차는 `infusion`(표기 **泡**, `infText`/`koInf`).
- **렌더 구조**: 도구 본체는 `assets/vessels/*.png`를 SVG `<image>`로 배치하고, 동적 현상만 SVG로 합성한다.
- **렌더 훅(도구별)**: `render()`가 분기 — 개완=찻물(`applyLiquor` + `#g-liquid/#g-surface`)·찻잎(`drawLeaves`/`#g-leaves`)·뚜껑 하이라이트(`#g-lid`, `lidTarget`→`lidLift` 스무딩), 표일배=윗챔버(`#py-chamber`)→버튼 배수(`drainPiao`, `#py-lower`/`drain`), 머그=수면색(`#mug-surface`), 불투명(티팟·동양식 다호)=`#ambient` 글로우. 김은 `setSteam`.
- **시간 링**: `#ring-prog`(둥근 도구만; `vessel().round`). 평소 가는 헤어라인, 막바지 `urgent`에 밝기·굵기↑(`setRing`). **세로 도구(표일배·머그)는 링 생략, 숫자 중심.**
- **신호**: 예고음 `preWarnSec = clamp(round(sec*0.2),3,5)`, 이후 매초 `tick()`, 완료 `chime()`(E5+B5 합성) + `.flash` + Wake Lock. 메시지(`#timeLabel`)는 **시간 숫자 위, 도구 위쪽**(`.message`)에 표시.
- **SVG 좌표계**: `viewBox 0 0 200 224`. 도구 그룹 `#v-<id>`(보일 것만 `display`), clipPath `gBowl/pyOut/pyIn/mugClip`, 찻잎 path는 `buildLeaves`에서 생성.

## 확정된 제품 결정 (바꾸지 말 것, 근거는 DESIGN.md)
- 이름 **차 한 잔의 시간 / Time for Tea**. 한국어 UI, 글씨체 **Gowun Batang**(고운바탕), 숫자 **Space Mono**.
- 회차 표기 **泡**(煎 아님). 한자 보조 + 한글 보조 병기.
- **표일배**: 우림은 윗 거름망 챔버에서, 완료 후 **메인 버튼을 눌러야** 아래 잔으로 배수(`done:"button"`, `liquorVisible:"chamber"`).
- 불투명 도구(도자 계열)는 탕색이 안 보이므로 **앰비언트 글로우+김**으로 진행 표현. 머그는 수면색만.
- **과침 카운트업 미도입**. 예고음 비례 축소(최소 3초). 틱 기본 ON. 권장 온도는 **차 선택 시 토스트로만**.
- 링은 기본 가는 헤어라인 → 시작 시점에 시선 안 뺏고 막바지에만 또렷.

## 현황 / 남은 일
- **검증됨**(미리보기·콘솔 무오류): 개완 전체 흐름, 표일배 버튼식 배수, 동양식 다호 앰비언트 글로우, 차/도구/회차/슬라이더/예고음·틱·종소리·플래시.
- **우림 연출 v0.2 대부분 적용됨**(활성 기준 [DESIGN.md](DESIGN.md)): 추출 포화 색곡선·찻물 세로 그라데이션·찻잎 sway/시차 펼침/pour 난류·따뜻한 앰버 앰비언트 글로우·김 강화(블러)+**주전자 뚜껑·꼭지 다포트 김**(`steamPorts`)·수면 일렁임·임박 SVG throb·pour 물줄기/잔물결·둥근 도구별 링 중심(`ringGeom`). 단, **개완 뚜껑 열림은 아직 미작동**(`#g-lid`가 숨겨짐).
- **TODO**: 선택값 **localStorage 영속**, **개완 뚜껑 열림 복구**, **폰트 셀프호스팅**(완전 오프라인), 차 캐러셀 스와이프, 회차별 색 점감, 백그라운드 타이머 보정·오디오 클록 예약.

## 작업 규칙
- 한국어로 답한다(사용자 한국인). 디자인 변경은 먼저 [DESIGN.md](DESIGN.md)에 반영하고 코드에 적용.
- 시각 변경 후에는 위 함정(SW 캐시·rAF)을 고려해 스크린샷으로 확인.

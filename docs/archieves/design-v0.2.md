# 차 한 잔의 시간 — Design v0.2 (우림 연출 정교화)

> 히스토리 스냅샷. 활성 설계 기준과 반영/거부 이력은 [DESIGN.md](../../DESIGN.md)를 본다.

작성일: 2026-06-15

> v0.1은 "고정 도구는 이미지, 변하는 현상은 코드"라는 하이브리드 렌더 구조를 확정했다. v0.2는 그 위에서 **우림이 시작되는 순간부터 완료까지의 동적 SVG 연출**을 점검하고 보완 방향을 정한다. UI/UX 디자이너 관점과 차 애호가 실사용 관점을 함께 반영한다.

## 1. 진단 — 우림 시간의 질감이 안 살아 있다

미리보기(모바일 375×812)에서 개완·동양식 다호·표일배의 실제 우림 프레임을 관찰한 결과:

- **개완 0:13** → 거의 무색, **0:05** → 갑자기 색·찻잎이 확 등장. 전반 50%는 변화가 안 읽히고 막판 25%에 몰린다.
- **동양식 다호** → 앰비언트 글로우가 거의 안 보이는 흐린 갈색 얼룩, 김도 미미.
- **표일배** → 상단 챔버가 우림 내내 거의 투명, 숫자가 챔버에서 멀리 위에 떠 있음.

핵심 원인은 **우림(steep) 동안 실제로 변하는 것이 평평한 `<rect>` 한 장의 투명도 한 줄뿐**이라는 점이다. 수위는 0.9초 pour 구간에서만 차오르고, 정작 수십 초의 우림 동안에는 색 알파만 바뀐다.

## 2. 보완 항목 (전체)

### A. 우선 구현 — 우림 중 SVG의 생동감

**A-1. 색 곡선을 추출 포화형으로**
현재 `ease`(easeInOutQuad)는 양끝이 느려 초반에 색이 거의 안 오른다. 실제 차 추출은 **초반에 빠르게** 색이 오르고 후반에 완만해지는 포화 곡선(≈ `1−e^(−kt)`)이다. 색/농도(`curAlpha`, `strengthT`)에는 ease-out(포화형) 곡선을 쓰고, 임박 연출 타이밍 계산과는 분리한다. → 전반 구간에서도 차가 들어오는 것이 보이게 된다.

**A-2. 찻물에 깊이(세로 그라데이션)**
`#g-liquid`는 단색 평면 `<rect>`다. 바닥이 진하고 수면이 옅은 세로 `linearGradient`를 주입해 액체의 부피감을 만든다. 탕색 2색(`light`/`strong`)을 그라데이션의 상/하 또는 농도축에 함께 사용한다.

**A-3. 찻잎이 살아 움직이게**
현재 `drawLeaves`는 펼침 각도·스케일·건조→습윤 색만 보간하고, 고정 로제트가 중앙에 박혀 "스탬프"처럼 보인다. 시간 기반의 느린 흔들림(sway)과 잎마다 시차를 둔 펼침을 더한다. 잎 분포·형태도 약간 다양화한다. (pour 난류로 떠올랐다 가라앉는 표현은 B로 미룬다.)

**A-4. 개완 뚜껑 열림(開蓋) 시각화 — 현재 미작동**
완료 제스처가 개완은 "뚜껑 들림"으로 정의돼 있고 `finishSteep`이 `lidTarget=1`을, `frame`이 `lidLift` 스무딩을 하지만, **`lidLift`가 어떤 transform에도 쓰이지 않고** render의 개완 분기가 `#g-lid` 불투명도를 항상 0으로 덮어쓴다. 결과적으로 완료 신호는 텍스트+플래시뿐이다. 본체가 단일 PNG라 뚜껑만 들 수는 없으므로, `#g-lid` 림라이트를 **위로 살짝 이동 + 틈 하이라이트**로 켜서 열림을 암시한다(향후 뚜껑 별도 레이어 PNG로 분리 시 실제 들림 연출).

### B. 다음 단계 — 임박/완료의 정서 (구현됨 2026-06-15)

- **B-1. 수면 일렁임 — ✅**: `shimmerSurf()`가 개완·표일배 수면 ellipse의 rx/ry를 시간 기반으로 미세 진동(임박 구간 amp↑). `#g-surface`가 크기·투명도만 변하던 문제 해소.
- **B-2. 불투명 도구 글로우·김 강화 — ✅**: 앰비언트를 차색 평면(최대 16%)에서 **따뜻한 앰버 radial gradient(`#ambientGlow`)** + 피크 ~30%로 교체. 김은 `#steamBlur`(gaussian) 적용, 불투명도 6%→21%, 포트당 최대 3가닥.
- **B-3. 임박을 SVG 내부로 — ✅**: `isUrgent` 플래그로 임박 시 앰비언트 글로우 throb(검증값 0.24↔0.36 진동) + 수면 일렁임 amp 증가. 잔 자체가 반응.
- **B-4. pour 연출 — ✅**: `#pour` 그룹(물줄기 `#pour-stream` + 착지 잔물결 `#pour-ripple`). 붓는 동안 물줄기가 입구로 하강하고, 착지하며 잔물결 링이 퍼졌다 페이드.

#### 추가: 김 분출구 다포트화 (사용자 요청 2026-06-15)
- `steamPorts()`가 도구별 분출구 배열을 반환. **주전자(티팟·동양식 다호)는 뚜껑 + 꼭지(주둥이) 두 곳**에서 동시 분출(꼭지는 가로 드리프트), 그 외 도구는 입구 한 곳. 검증: 피크에서 김 6가닥(2포트×3).

#### 표일배 지오메트리 정합 (구현됨 2026-06-15)
- **아래 팟 채움 위치 — ✅**: `pyOut` clip이 컵 중간(y139–170)에 떠 있어 배수 시 찻물이 중간에 고이고 바닥이 비던 문제 → 컵 바닥 영역으로 이동, 바닥부터 차오름(`lowTop=lerp(...,drain)`).
- **버튼 — ✅ 합성 오버레이 제거**: 처음엔 `py-button`(흰 반투명 캡)을 뚜껑 꼭지에 정렬하려 했으나, **PNG 자산에 이미 로즈골드 버튼이 그려져 있어** 합성 캡은 미묘하게 어긋나는 군더더기였다(스크린샷 교차 확인). `py-button` 마크업·els 캐시·render의 누름 transform을 모두 삭제. 배수 피드백은 찻물 하강·챔버 비움·메시지(`出湯`)·메인 버튼 라벨로 충분. → 교훈: **자산이 이미 표현하는 요소를 SVG로 덧그리지 말 것**(중복·정렬오차만 생김).

##### 2차 보정 — Codex 교차검증 반영 (2026-06-15)
1차 수정은 "컵 중간에 뜨는 버그"는 고쳤으나 지오메트리가 덜 맞았다. Codex가 배수 화면을 오버레이로 분석(화면 좌표→viewBox 환산 스케일 ≈1.667, offset x20.75/y149.08)해 세 문제를 지적, 반영함:
- **clip이 컵 외곽 폭에 가까워 찻물이 "바닥에 깔린 노란 면"으로 읽힘** → `pyOut`을 **내부컵(x73–127, y156–200)** 으로 축소(이전 x67–133). 좌우로 유리벽이 보여 "유리 안에 담긴 차"가 됨. (오버레이로 내벽 정합 확인)
- **단색 rgb rect라 깊이감 없음** → 전용 세로 그라데이션 `#pyLowerGrad`(수면 쪽 진함 → 바닥 투명) 도입, `py-lower` fill을 `url(#pyLowerGrad)`로. 바닥 경계가 부드러워짐(유리 굴절감).
- **opacity .7은 강함** → **.56**으로 하향(Codex 권장 .45–.58), 수면 ellipse도 rx 30→25·opacity .48.

##### 3차 보정 — Codex가 path화 + 사용자 후속 요청 (2026-06-15)
- (Codex) `py-lower`를 rect→`path`(`pyLowerPath(top, drain)`: 수면 돔 + 바닥 테이퍼 + 컵 끝 위 y190에서 끊기)로 바꿔 "유리 안에 담긴 차"를 완성. opacity .42·수면 .34. (회고는 §5.8)
- **찻잎이 챔버를 벗어남 — ✅**: `py-leaves`의 아래 방향 petal(base 120·240)이 챔버 바닥(y144) 밑으로 ~y150까지 삐져나옴(격자 확인). → `py-leaves`에 `clip-path="url(#pyIn)"` 추가(챔버에 가둠) + 앵커를 y138~143→y135~139로 상향. 찻잎이 거름망 바닥에 머무름.
- **찻물 수위 상향 — ✅**: 손잡이 하단 부착부(기준선 측정 ≈y150)보다 찻물이 낮아 보임 → `lowTop` 최종 y160→**y154**(손잡이 하단 살짝 밑), `pyOut` clip 상단도 y156→y149로 올려 높아진 수면이 안 잘리게.

#### 미세 조정 (구현됨 2026-06-15)
- **찻잎 pour 난류 — ✅**: `agitate` 인자(pour 즉시 1로 최고조 → 우림 시작 후 1.5초간 0으로 감쇠). `drawLeaves`에서 마른 잎이 들썩(소용돌이 회전 + 상하 부유 + 가시화)였다 가라앉음. pour 동안 openEff=0이라 안 보이던 잎이 난류로 드러남.
- **둥근 도구별 링 중심 — ✅**: `ringGeom()`/`applyRingGeom()`로 도구별 중심·반경 지정(개완 cy124·r90, 동양식 다호 cy130·r85, 티팟 cy132·r95). `ringC`·`rotate` 동적 갱신. CLAUDE.md의 "다호·티팟 링이 약간 높음" 해소.

### C. 제품·접근성

- **C-1. 도구별 권장 시간 배율**: base/add가 전부 개완 공부차 스케일이라 머그/티팟에도 녹차 15초를 권한다. 도구 계열별 시간 배율(공부차 vs 서양식)을 둔다.
- **C-2. 회차별 색 점감**: `peak`이 차마다 1개뿐이라 5泡도 1泡과 같은 농도로 보인다. 회차에 따라 peak를 점감한다.
- **C-3. 도구 선택 발견성**: 차는 dots+안내가 있으나 도구는 이름 라벨뿐이고 셰브런 대비가 낮다. 도구에도 dots/세그먼트와 대비를 보강한다.
- **C-4. 접근성**: `#time`·`#timeLabel`에 `aria-live`가 없어 스크린리더가 카운트다운/완료를 못 읽는다. 슬라이더 ±버튼은 30px로 최소 44px 미달.
- **C-5. 완료 가독성**: 플래시가 화면을 덮을 때 크림색 숫자/메시지 대비가 떨어진다.
- **C-6. 폰트 오프라인**: 아직 Google Fonts CDN 의존 → 오프라인 PWA에서 글꼴 깨짐(셀프호스팅).

## 3. 우선순위

| 순위 | 항목 | 효과/비용 |
|---|---|---|
| **A** | A-1 색곡선 + A-2 액체 그라데이션 | 우림 시간이 색으로 읽힘 / 낮음 |
| **A** | A-3 찻잎 sway·시차 펼침 | "살아있는 우림" 체감 핵심 / 중간 |
| **A** | A-4 개완 뚜껑 열림(현재 미작동) | 정의된 완료 신호 복구 / 낮~중 |
| **B ✅** | B-2 글로우·김 강화(+김 뚜껑·꼭지 다포트) | 불투명 도구 진행감 / 낮음 |
| **B ✅** | B-1 수면 일렁임 + B-3 임박 SVG화 | 긴장 곡선 완성 / 중간 |
| **B ✅** | B-4 pour 연출 | 첫 순간 정서 / 중간 |
| **C** | C-1/C-2 시간 배율·회차 색 점감 | 차 애호가 신뢰도 / 중간 |
| **C** | C-3~C-6 발견성·접근성·완료 대비·폰트 | 완성도 / 낮음 |

## 4. 구현 범위 (A 묶음)

전부 `index.html` 한 파일의 `frame` / `render` / `drawLeaves` / `applyLiquor`와 개완 SVG 정의(`#g-liquid` 그라데이션, `#g-lid`)만 건드린다. 도구 자산·레이아웃·상태 머신은 변경하지 않는다.

---

## 5. 화면 검증 기법 (개발·QA 절차)

> v0.2 연출 작업과 표일배 버그 수정에서 실제로 쓴 검증 절차. 이 앱은 두 함정 때문에 평범한 "수정→새로고침→스크린샷"이 통하지 않는다(근거 [CLAUDE.md](CLAUDE.md) ⚠️ 절):
> 1. **서비스워커가 cache-first** → 그냥 새로고침하면 옛 `index.html`이 캐시에서 뜸.
> 2. **헤드리스 미리보기는 비활성 시 `requestAnimationFrame`을 throttle** → `frame()`이 멈춰 카운트다운·애니메이션이 안 흐른 듯 보임(버그 아님).
>
> 도구: 미리보기 서버 `python3 -m http.server 8123`([.claude/launch.json](.claude/launch.json)), 뷰포트 **mobile 375×812 고정**. viewBox는 `0 0 200 224`이므로 아래 좌표는 모두 viewBox 단위.

### 5.1 매 수정 후 필수 루틴
1. **SW 해제 + 캐시 삭제 + 리로드** (이걸 빼면 옛 코드가 뜸):
   ```js
   (async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();
   for(const k of await caches.keys())await caches.delete(k);location.reload();return 'r';})()
   ```
2. **콘솔 오류 확인**: `preview_console_logs(level:"error")` → "No console logs" 확인.
3. **리로드 레이스 주의**: 리로드 직후 클릭이 *옛 페이지*에 떨어질 수 있다. 조작 전 `eval`로 상태를 읽어 새 페이지가 떴는지 확인한다.
   ```js
   document.getElementById('vesselName').textContent   // 예: "표일배"인지 확인 후 클릭
   ```
4. 리로드하면 아래의 런타임 주입 오버레이(격자·디버그)는 모두 사라진다 → 코드에 흔적이 안 남는다.

### 5.2 정적 좌표 측정 — 격자 오버레이
SVG 요소를 PNG 자산에 맞춰 배치할 때(챔버 clip, 김 분출구, 링 중심, 버튼 위치) viewBox 좌표를 눈으로 읽는다. 격자선+라벨을 `#stage`에 주입(가로=초록 y, 세로=파랑 x, 20단위 강조)하고 스크린샷:
```js
(()=>{const svg=document.getElementById('stage'),NS="http://www.w3.org/2000/svg";
 document.querySelectorAll('.grid').forEach(e=>e.remove());
 for(let y=45;y<=215;y+=10){const l=document.createElementNS(NS,'line');
   l.setAttribute('x1',30);l.setAttribute('x2',170);l.setAttribute('y1',y);l.setAttribute('y2',y);
   l.setAttribute('stroke',y%20===5?'#00ff88':'#ffcc00');l.setAttribute('stroke-width',.4);l.setAttribute('class','grid');svg.appendChild(l);
   const t=document.createElementNS(NS,'text');t.setAttribute('x',2);t.setAttribute('y',y+2);
   t.setAttribute('fill','#00ff88');t.setAttribute('font-size',6);t.setAttribute('class','grid');t.textContent=y;svg.appendChild(t);}
 for(let x=40;x<=160;x+=20){const l=document.createElementNS(NS,'line');
   l.setAttribute('y1',45);l.setAttribute('y2',215);l.setAttribute('x1',x);l.setAttribute('x2',x);
   l.setAttribute('stroke','#3bafff');l.setAttribute('stroke-width',.4);l.setAttribute('class','grid');svg.appendChild(l);
   const t=document.createElementNS(NS,'text');t.setAttribute('y',52);t.setAttribute('x',x-3);
   t.setAttribute('fill','#3bafff');t.setAttribute('font-size',6);t.setAttribute('class','grid');t.textContent=x;svg.appendChild(t);}
 return 'grid';})()
```
- 좁은 영역(버튼·꼭지)은 step을 4~5로 줄여 세밀 격자를 쓴다.
- 이 방법으로 얻은 실측: 표일배 거름망 바닥 ≈y144, 컵 바닥 ≈y199, 뚜껑 꼭지 ≈y55 / 티팟 뚜껑(100,90)·꼭지(32,104) / 동양식 다호 뚜껑(100,95)·꼭지(42,107) / 링 중심 개완 cy124·다호 cy130·티팟 cy132.

### 5.3 영역(clipPath) 정합 검증 — 경로 오버레이
clipPath나 채움 영역이 PNG의 실제 형상과 맞는지, 밝은 선으로 외곽을 그려 비교한다. (표일배 "아래 팟이 컵 중간에 떠 있음" 버그를 이걸로 발견.)
```js
(()=>{const svg=document.getElementById('stage'),NS="http://www.w3.org/2000/svg";
 const mk=(d,c)=>{const p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.setAttribute('fill','none');
   p.setAttribute('stroke',c);p.setAttribute('stroke-width',1);p.setAttribute('class','dbg');svg.appendChild(p);};
 mk("M67 150 L67 190 C67 196 74 199 100 199 C126 199 133 196 133 190 L133 150 Z","#ff8c00"); // pyOut
 mk("M80 105 L80 130 C80 139 89 144 100 144 C111 144 120 139 120 130 L120 105 Z","#3bafff"); // pyIn
 return 'marked';})()
```
- 기존 요소를 밝게 칠해 위치를 보려면 그 요소의 `fill`/`stroke`를 임시 변경(예: `py-button`의 자식을 빨강). 리로드로 원복된다.

### 5.4 시간 진행·애니메이션 검증 — 두 방법
헤드리스에서 rAF가 throttle되므로 가만히 두면 시간이 안 흐른다. 두 가지로 푼다.

**(a) 연속 스크린샷** — 각 스크린샷이 페인트 1프레임을 강제하고, 호출 간격(수 초의 라운드트립)만큼 실시간이 흐른다. 색 심화·완료처럼 **느린 변화**를 몇 컷으로 확인할 때 적합. 단, 어디서 잡힐지 정확히 통제 못 함.

**(b) rAF 구동 샘플링(권장·정밀)** — `eval` 안에서 `await new Promise(r=>requestAnimationFrame(r))` 루프를 돌리면 페이지가 활성화돼 앱의 `frame()`이 같이 실행된다. 원하는 프레임에서 DOM 속성을 표집해 **수치로 검증**한다. throb 진폭·채움 높이·입자 수처럼 정확도가 필요할 때 필수.
```js
(async()=>{
  const slider=document.getElementById('slider'); slider.value=8; slider.dispatchEvent(new Event('input'));
  const amb=document.getElementById('ambient'), steam=document.getElementById('steam'),
        time=document.getElementById('time'), brew=document.getElementById('brew');
  brew.click();
  const ambUrgent=[]; let maxSteam=0;
  for(let i=0;i<600;i++){ await new Promise(r=>requestAnimationFrame(r));
    maxSteam=Math.max(maxSteam, steam.children.length);
    const tx=time.textContent; if(tx==='0:03'||tx==='0:02'||tx==='0:01') ambUrgent.push(+amb.getAttribute('opacity'));
    if(brew.textContent.includes('다음')) break; }
  return {maxSteam, min:Math.min(...ambUrgent), max:Math.max(...ambUrgent)};
})()
```
이렇게 얻은 검증값 예: 임박 글로우 throb `0.24↔0.36`, 김 피크 6가닥(2포트×3), pour 물줄기 height 0→74 후 잔물결 rx 0→22 페이드, 배수 후 아래 팟 `y160·height39`(컵 바닥), 챔버 `opacity 0`.

### 5.5 짧은 이벤트(pour 0.9초 등) 포착
도구 라운드트립이 수 초라 0.9초 pour를 스크린샷으로 잡기 어렵다.
- **수치 검증**은 5.4(b)로: `brew.click()` 후 rAF를 N프레임 돌리며 `#pour`·`#pour-stream` 등을 표집(프레임 수로 진행 구간을 통제).
- **시각 컷**이 필요하면 같은 `eval`에서 click→rAF 진행 후 곧바로 스크린샷. 단 라운드트립 동안 실시간이 더 흐르므로 이미 다음 단계로 넘어가 있을 수 있다(개완 pour를 노렸는데 0:09 steep이 잡히는 식). 정확성은 (b)의 DOM 샘플링이 우선.

### 5.6 상태 머신 구동·전체 흐름 표집
도구/차/회차는 버튼 클릭으로 구동(`#vesselNext`/`#vesselPrev`/`#brew`/`#reset`). 우림→완료→배수 같은 다단계는 하나의 `eval`에서 라벨 변화로 단계를 감지하며 진행:
```js
brew.click();                                   // 시작
for(...) { await rAF; if(brew.textContent.includes('버튼')) break; }  // done(표일배) 대기
brew.click();                                   // 배수
for(let i=0;i<150;i++) await rAF;               // 배수 애니(1.4s) 경과
// 이후 py-lower/py-chamber 속성 표집
```

### 5.7 마무리 규칙
- 검증이 끝나면 `#reset`으로 **정지 상태(idle)** 로 되돌려 둔다.
- 디버그/격자 오버레이는 런타임 주입이라 리로드로 사라진다 — 절대 소스에 커밋하지 않는다.
- 색·정밀 스타일은 스크린샷보다 `preview_inspect`(계산된 CSS) 또는 위 DOM 속성 표집으로 확인한다.

### 5.8 좌표 검증의 맹점 (표일배 아래 팟 사례 회고)
위 DOM/오버레이 검증은 **"의도한 좌표·영역에 들어갔는가"** 는 정확히 잡지만, **"그게 그럴듯하게 보이는가(재질감)"** 는 못 잡는다. 표일배 아래 찻물을 여러 번 고치고도 덜 맞았던 이유:
- **좌표 일치 ≠ 물성 신뢰도.** `py-lower`가 컵 내벽 안(y162–200)에 들어간 걸 표집으로 확인하고 "검증 완료 ✓"로 닫았지만, 실제로는 "유리 안에 담긴 차"가 아니라 "바닥에 깔린 노란 면"으로 읽혔다. 위치는 맞고 보이는 건 틀린 상태.
- **primitive 한계 신호 놓침.** "더 좁게 + 그라데이션 + 바닥 페이드"가 동시에 필요해진 순간, `rect`+clip+`linearGradient`로는 위조밖에 안 된다 = **primitive가 틀렸다는 신호**였다. 결국 Codex가 `rect`→파라메트릭 `path`(`pyLowerPath`: 수면 돔 + 바닥 테이퍼 + 컵 끝 위 y190에서 끊기)로 바꿔 해결.
- **교훈 ①**: 같은 결함을 두세 번 *좌표만 바꿔* 고치고 있으면 멈추고 "이 primitive(rect+clip)가 이 현상(액체)을 표현할 수 있나"를 되물어라. clip은 영역(스필 방지)이고, 형태는 fill/path가 책임진다 — 둘을 혼동하지 말 것.
- **교훈 ②**: 시각 작업의 완료 판정은 좌표 표집만으로 닫지 말고, **렌더 이미지를 "처음 보는 사람" 시선으로 정성 평가**(굴절·경계 부드러움·"담긴 차"인가)한 뒤 닫는다. 도메인 지식("유리 굴절감")은 opacity가 아니라 **지오메트리**로 옮겨야 살아난다.

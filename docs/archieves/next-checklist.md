# 디자인 보완 — 다음 체크리스트

> 2026-06-18 현재 이 체크리스트는 [DESIGN.md](../../DESIGN.md) §11 남은 일로 통합되었다. 이 파일은 원문 기록으로만 둔다.

> 2026-06-18 디자인 검토에서 도출. 1–4번(터치 타깃·aria-live·플래시 reduced-motion·대비)은 적용 완료.

## 5. 개완 뚜껑 열림 복구 (E-1) — 중간

`lidLift`가 계산되지만 실제 transform에 안 쓰임. `render()`에서 `#g-lid` opacity를 항상 0으로 덮어씀(`index.html:642`). 완료 시 뚜껑 열림 시각 피드백이 없다.

- `#g-lid`에 `lidLift` 기반 `translateY` + opacity 적용
- 본체가 단일 PNG라 실제 분리는 불가 → 림라이트를 위로 이동 + 틈 하이라이트로 열림 암시
- 향후 뚜껑 별도 PNG 레이어 분리 시 실제 들림 연출 가능

## 6. localStorage 영속 (E-3) — 중간

CLAUDE.md TODO. 앱을 닫으면 차/도구/시간 선택이 리셋된다.

- 저장: `lastVesselId`, `lastTeaId`, `lastSecByTea`, `muted`
- `boot()`에서 복원, 선택 변경 시 저장
- 스키마: DESIGN.md §5.4 참조

## 7. 폰트 셀프호스팅 (C) — 중간

현재 Google Fonts CDN 의존(`index.html:10-12`). 오프라인 PWA에서 글꼴 깨짐.

- Gowun Batang 400/700 + Space Mono 400/700 서브셋(한글+숫자+기호)
- `fonts/` 디렉토리에 woff2 배치, `@font-face` 인라인
- `sw.js` 캐시 목록에 폰트 추가

## 8. 차 캐러셀 스와이프 (D-3) — 낮음

히어로는 도구 스와이프 있으나, 차 캐러셀은 셰브런 클릭만 가능. DESIGN.md §3.2③에 "스와이프/탭으로 전환" 명시.

- `.carousel .track`에 `touchstart`/`touchend` 리스너 추가
- 히어로 스와이프와 같은 40px 임계값 패턴 재사용

## 9. 회차별 색 점감 (C-2) — 중간

`tea().peak`이 infusion과 무관하게 고정. 5泡도 1泡과 같은 농도로 보임.

- `infusionPeaks` 배열 또는 감쇠 함수(`peak * decay^(inf-1)`) 도입
- DESIGN.md §5.2의 `infusionPeaks` 스키마 참조

## 10. 우림 중 중단 (D-1) — 낮음

DESIGN.md §3.2⑤ "길게 누르면 '지금 멈추기' 옵션" 미구현.

- brew 버튼에 `touchstart`/`touchend` 타이머(~800ms)로 long-press 감지
- 확인 후 `reset()` 호출

## 11. 도구 전환 전이 효과 (D-2) — 낮음

`display:none↔block` 즉시 교체. 현재 위치의 공간적 단서 없음.

- CSS `opacity` + `transition`으로 크로스페이드, 또는
- 방향에 따른 좌우 슬라이드

/**
 * lib/toast/index.ts 단위 테스트
 *
 * - toast.success / error / warn / info 이벤트 발생 검증
 * - payload 구조 (id, type, message, duration) 검증
 * - CustomEvent 발행 확인
 */

import { toast, EVENT_NAME, type ToastPayload } from '@/lib/toast';

describe('lib/toast', () => {
  let dispatchedEvents: CustomEvent<ToastPayload>[] = [];

  beforeAll(() => {
    const originalDispatch = window.dispatchEvent.bind(window);
    jest.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      if (event.type === EVENT_NAME) {
        dispatchedEvents.push(event as CustomEvent<ToastPayload>);
      }
      return originalDispatch(event);
    });
  });

  beforeEach(() => {
    dispatchedEvents = [];
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  function last(): CustomEvent<ToastPayload> {
    const ev = dispatchedEvents[dispatchedEvents.length - 1];
    if (!ev) throw new Error('이벤트가 발생하지 않았습니다');
    return ev;
  }

  it('toast.success는 type=success 이벤트를 발행한다', () => {
    toast.success('저장되었습니다');
    expect(dispatchedEvents).toHaveLength(1);
    expect(last().detail.type).toBe('success');
    expect(last().detail.message).toBe('저장되었습니다');
  });

  it('toast.error는 type=error 이벤트를 발행한다', () => {
    toast.error('오류가 발생했습니다');
    expect(last().detail.type).toBe('error');
    expect(last().detail.message).toBe('오류가 발생했습니다');
  });

  it('toast.warn는 type=warn 이벤트를 발행한다', () => {
    toast.warn('경고 메시지');
    expect(last().detail.type).toBe('warn');
  });

  it('toast.info는 type=info 이벤트를 발행한다', () => {
    toast.info('정보 메시지');
    expect(last().detail.type).toBe('info');
  });

  it('각 이벤트는 고유한 id를 가진다', () => {
    toast.success('msg1');
    toast.success('msg2');
    const ids = dispatchedEvents.map((e) => e.detail.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('기본 duration: success=3000, error=5000, warn=4000, info=3000', () => {
    toast.success('s');
    toast.error('e');
    toast.warn('w');
    toast.info('i');
    const durations = dispatchedEvents.map((ev) => ev.detail.duration);
    expect(durations[0]).toBe(3000);
    expect(durations[1]).toBe(5000);
    expect(durations[2]).toBe(4000);
    expect(durations[3]).toBe(3000);
  });

  it('커스텀 duration을 지정할 수 있다', () => {
    toast.error('오류', 10000);
    expect(last().detail.duration).toBe(10000);
  });

  it('payload에 id, type, message, duration 필드가 모두 있다', () => {
    toast.success('완전한 페이로드');
    const payload = last().detail;
    expect(payload).toHaveProperty('id');
    expect(payload).toHaveProperty('type');
    expect(payload).toHaveProperty('message');
    expect(payload).toHaveProperty('duration');
    expect(typeof payload.id).toBe('string');
    expect(payload.id.length).toBeGreaterThan(0);
  });
});

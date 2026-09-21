import assert from 'node:assert/strict';
import { Quaternion, Euler } from 'three';
import { captureBootReturn, bootReturnPose } from './heroBootReturn.ts';
const rad = d => d * Math.PI / 180;
for (const yaw of [0,180,-180,359,361,720,740,-361,-720]) {
  for (const pitch of [-45,0,45]) {
    const start = captureBootReturn({ x: rad(pitch), y: rad(yaw) });
    assert.deepEqual(bootReturnPose(start, 0), { x: rad(pitch), y: rad(yaw) });
    assert.ok(Math.abs(start.targetYaw-start.y) <= Math.PI + 1e-12);
    if (Math.abs(yaw) === 180) assert.ok(start.targetYaw < start.y, 'half-turn tie always negative');
    if (yaw === 740) assert.ok(Math.abs(start.targetYaw-start.y-rad(-20)) < 1e-12);
    for (let i=0;i<=100;i++) {
      const p=bootReturnPose(start,i/100), e=new Euler(p.x,p.y,0);
      assert.equal(e.z,0); assert.ok(Math.abs(p.x)<=Math.abs(start.x));
      if(i===100) assert.ok(new Quaternion().setFromEuler(e).angleTo(new Quaternion())<1e-7);
    }
  }
}
console.log('PASS: bounded shortest yaw, stable half-turn tie, ±45° pitch, zero roll, multi-turn continuity and canonical end orientation');

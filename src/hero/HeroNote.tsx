/** RECONSTRUCTED EXPERIENCE-LAYER OBJECT — never an iOS surface. */
export function HeroNote({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <group name="HeroOnboardingNote" position={[-1.85, 0.06, 0.1]} rotation={[0.01, 0.035, -0.055]}>
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1.5, 2.02, 0.018]} />
      <meshStandardMaterial color="#e7ddc6" roughness={0.82} metalness={0} />
    </mesh>
    <mesh position={[0.018, -0.018, -0.012]} receiveShadow>
      <boxGeometry args={[1.5, 2.02, 0.005]} />
      <meshStandardMaterial color="#554d42" roughness={1} transparent opacity={0.22} />
    </mesh>
  </group>;
}

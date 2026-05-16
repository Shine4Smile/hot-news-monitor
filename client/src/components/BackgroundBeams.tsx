/**
 * 背景光束效果组件
 */
export function BackgroundBeams({ className }: { className?: string }) {
  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className || ''}`}>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyber-neon/5 rounded-full blur-3xl" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-cyber-pulse/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyber-neon/3 rounded-full blur-3xl" />
    </div>
  );
}

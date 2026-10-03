export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#02040a]">
      <style>{`
          @keyframes blob-float-1 {
              0%, 100% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(30px, -50px) scale(1.1); }
              66% { transform: translate(-20px, 20px) scale(0.9); }
          }
          @keyframes blob-float-2 {
              0%, 100% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(-30px, 50px) scale(1.2); }
              66% { transform: translate(20px, -20px) scale(0.8); }
          }
      `}</style>

      {/* Deep Space Base */}
      <div className="absolute inset-0 bg-linear-to-b from-black via-[#050510] to-[#0a0a1a]" />

      {/* Dynamic Moving Orbs */}
      <div className="absolute top-0 left-1/4 w-[40vw] h-[40vw] bg-blue-600/10 rounded-full blur-[120px] animate-[blob-float-1_20s_infinite_ease-in-out]" />
      <div className="absolute bottom-0 right-1/4 w-[40vw] h-[40vw] bg-purple-600/10 rounded-full blur-[120px] animate-[blob-float-2_25s_infinite_ease-in-out_reverse]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] bg-indigo-900/10 rounded-full blur-[150px] animate-pulse" />

      {/* Faded Grid Overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
                  linear-gradient(to right, rgba(59, 130, 246, 0.05) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(59, 130, 246, 0.05) 1px, transparent 1px)
              `,
          backgroundSize: "4rem 4rem",
          maskImage:
            "radial-gradient(circle at center, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(circle at center, black 30%, transparent 80%)",
        }}
      />
    </div>
  );
}

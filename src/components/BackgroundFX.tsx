export default function BackgroundFX() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* soft grid */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse at center, black 75%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 75%, transparent 100%)",
        }}
      />
      {/* color blobs */}
      <div className="absolute -top-24 -left-24 h-[30rem] w-[30rem] rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/25 blur-3xl" />
      {/* glare sweep */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 h-24 w-[90%] rounded-full bg-white/40 blur-2xl" />
    </div>
  );
}

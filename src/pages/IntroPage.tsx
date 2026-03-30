const IntroPage = ({ onEnter }: { onEnter: () => void }) => {
  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center gap-6" style={{ backgroundColor: '#1a1a1a' }}>
      <h1 className="text-3xl font-extrabold uppercase tracking-[0.15em] text-white">Eagle POS System</h1>
      <img src="/placeholder.svg" alt="Eagle Logo" className="w-32 h-32" />
      <button
        onClick={onEnter}
        className="px-12 py-3 text-lg font-extrabold uppercase text-white"
        style={{ backgroundColor: '#00cc13', borderRadius: '6px', boxShadow: '0 0 16px #00cc1380' }}
      >
        Enter
      </button>
    </div>
  );
};

export default IntroPage;

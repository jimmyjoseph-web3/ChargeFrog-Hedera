const FloatingMenuBarBgCover = () => {
  return (
    <div className="fixed bottom-0 left-0 w-full h-[15vh] min-h-[70px] max-h-[90px] bg-white z-[999]">
      {/* blur/fade overlay */}
      <div
        className="absolute -top-10 left-0 right-0 h-10 
          bg-gradient-to-t from-white via-white/80 to-transparent 
          rounded-t-full pointer-events-none"
      />
    </div>
  );
};

export default FloatingMenuBarBgCover;

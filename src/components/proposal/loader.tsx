export default function Loader() {
  return (
    <>
      <div className="flex flex-col items-center justify-center h-screen text-gray-700">
        <img
          src="/station/frog-loader.gif"
          alt="Loading frog"
          className="w-60 h-50 -m-6"
        />
        <p className="text-lg text-gray-500 font-mono font-semibold mb-8">
          Fetching proposal...
        </p>
      </div>
    </>
  );
}

import Image from "next/image";

export default function UnsupportedPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white text-center px-6">
      <Image
        src="/unsupported.png"
        alt="ChargeFrog mobile only illustration"
        width={350}
        height={350}
        className="mb-25"
        priority
      />
      <h1 className="text-4xl font-bold mb-8">
        ChargeFrog loves hopping on phones — not desktops!
      </h1>
      <p className="text-lg text-gray-300">
        Please open the app using your mobile browser.
      </p>
    </div>
  );
}

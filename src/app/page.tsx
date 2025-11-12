import Image from "next/image";
import ConnectWalletButton from "../components/connectWalletButton";

export default function Home() {
  return (
    <>
      {/* Fixed illustration + title + description */}
      <div
        className="
          fixed inset-x-0 
          bottom-[calc(10vh+2rem)] 
          z-[100] flex flex-col items-center justify-center px-4
          text-center space-y-6
        "
      >
        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-medium">
          Leap Into The Future of EV with{" "}
          <span className="text-[#00DD00]">ChargeFrog</span>
        </h1>

        {/* Body Text */}
        <p className="text-md md:text-xl text-gray-700">
          Charge seamlessly across Europe
          <br />
          and own the network you love and rely on.
        </p>

        {/* Image */}
        <div className="w-full max-w-lg">
          <Image
            src="/login-screen-frog.png"
            alt="ChargeFrog Login Screen"
            width={600}
            height={400}
            priority
          />
        </div>
      </div>

      {/* Connect Wallet Button */}
      <ConnectWalletButton />
    </>
  );
}

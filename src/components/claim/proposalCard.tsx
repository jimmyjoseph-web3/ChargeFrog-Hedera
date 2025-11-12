import Image from "next/image";

interface ProposalCardProps {
  stationLocation: string;
  proposalNumber: number;
  latestPayoutDate: string;
  nextPayoutDate: string;
  numberOfTokenInvested: number;
  earningInHbar: number;
  buttonState: {
    text: string;
    disabled: boolean;
  };
  onClick: () => void;
}

export default function ProposalCard({
  stationLocation,
  proposalNumber,
  latestPayoutDate,
  nextPayoutDate,
  numberOfTokenInvested,
  earningInHbar,
  buttonState,
  onClick,
}: ProposalCardProps) {
  const baseClasses = "w-full text-white rounded-xl py-3 mt-5";

  const colorClasses = buttonState.disabled
    ? "bg-gray-300 cursor-not-allowed"
    : "bg-black hover:bg-gray-900";

  return (
    <div className="w-full text-left bg-white rounded-2xl border border-gray-50 shadow-sm p-6 flex flex-col items-start space-y-2">
      {/* Station Location Label */}
      <span className="text-sm text-gray-700 font-normal">
        {stationLocation}
      </span>

      {/* Proposal Title */}
      <h1 className="text-2xl font-medium">
        CF Station Proposal #{proposalNumber}
      </h1>

      {/* Left and Right info (Latest / Next payout) */}
      <div className="flex flex-col text-sm text-gray-700 space-y-1 mt-2">
        <span>
          Latest payout on{" "}
          <span className="font-bold text-black">{latestPayoutDate}</span>
        </span>
        <span>
          Next payout on{" "}
          <span className="font-bold text-black">{nextPayoutDate}</span>
        </span>
      </div>

      {/* Token info */}
      <div className="w-full flex justify-between text-sm text-gray-700 mt-5">
        <span className="flex items-center space-x-1">
          <Image src="/claim/invest.png" alt="Invest" width={25} height={25} />
          <span className="font-bold text-black text-md">
            {numberOfTokenInvested} tokens invested
          </span>
        </span>
      </div>

      {/* Earning info */}
      <div className="flex items-center text-sm text-gray-700 space-x-1">
        <Image src="/claim/earning.png" alt="Earning" width={21} height={21} />
        <span className="font-bold text-black text-md ml-1">
          {earningInHbar} HBAR claimed
        </span>
      </div>

      {/* Check and claim button */}
      <button
        onClick={onClick}
        disabled={buttonState.disabled}
        className={`${baseClasses} ${colorClasses}`}
      >
        {buttonState.text}
      </button>
    </div>
  );
}

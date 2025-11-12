import Image from "next/image";
import FinancialBreakdown from "./financialBreakdown";
import Timeline from "./timeline";
import TokenizationInfo from "./tokenizationInfo";
import InvestmentStats from "./investmentStats";
import InvestButton from "./investButton";

export default function ProposalContent({ station }: { station: any }) {
  const ports = station.portsInfo || [];

  // Group ports by AC/DC and count them
  const portSummary = ports.reduce((acc: any, port: any) => {
    const key = port.acdc?.toUpperCase() || "UNKNOWN";
    if (!acc[key]) {
      acc[key] = { count: 0, acdc: key, type: port.type, kW: port.kW };
    }
    acc[key].count += 1;
    return acc;
  }, {});

  const portGroups = Object.values(portSummary);

  return (
    <div className="pt-8">
      {/* --- Header Info --- */}
      <p className="text-sm text-gray-500 font-normal">
        ChargeFrog Station Proposal #{station.proposalId}
      </p>
      <h1 className="text-3xl font-medium text-black mt-3">
        {station.stationName}
      </h1>

      {/* --- Location + Pills --- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 text-sm text-gray-700 mt-4">
        <div className="flex items-center gap-1">
          <Image
            src="/station/location.png"
            alt="Location"
            width={18}
            height={18}
          />
          <a
            href={station.googleMapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-600 transition mr-1"
          >
            View on Google Map
          </a>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 flex-wrap mt-2">
          <span className="px-4 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-semibold">
            {station.locationCategory}
          </span>
          <span className="px-4 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-semibold">
            Public
          </span>
          <span className="px-4 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-semibold">
            24 Hours Operation
          </span>
        </div>
      </div>

      {/* --- Why this location --- */}
      <div className="mt-8">
        <h2 className="text-xl font-medium text-gray-900 mb-2">
          Why this location?
        </h2>
        <p className="text-gray-700 text-sm leading-relaxed">
          {station.whyThisLocation || "No description provided."}
        </p>
      </div>

      {/* --- Nearby amenities --- */}
      <div className="mt-6">
        <h2 className="text-xl font-medium text-gray-900 mb-4">
          Nearby amenities
        </h2>
        <div className="flex justify-between items-stretch gap-3">
          {[
            { icon: "wifi", label: "WiFi" },
            { icon: "shops", label: "Shops" },
            { icon: "cafe", label: "Cafe" },
            { icon: "tyre", label: "Air" },
          ].map((item) => (
            <div
              key={item.icon}
              className="flex flex-col items-center justify-center bg-gray-50 rounded-lg p-4 w-1/4"
            >
              <Image
                src={`/proposal/${item.icon}.png`}
                alt={item.label}
                width={35}
                height={35}
                className="mb-2"
              />
              <span className="text-gray-700 text-sm font-semibold">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* --- Station Specifications --- */}
      <div className="mt-6 pb-35">
        <h2 className="text-xl font-medium text-gray-900 mb-4">
          Station specifications
        </h2>

        <div className="flex justify-between items-stretch gap-3">
          {/* Total Ports */}
          <div className="flex flex-col items-center justify-center bg-gray-50 rounded-lg p-4 w-1/3 text-center">
            <Image
              src="/proposal/station.png"
              alt="Station"
              width={40}
              height={40}
              className="mb-2"
            />
            <span
              className="text-gray-700 text-sm font-semibold mt-1"
              dangerouslySetInnerHTML={{
                __html: `${station.numberOfPort} Ports <br/> Available`,
              }}
            />
          </div>

          {/* Grouped Ports (AC/DC) */}
          {portGroups.map((group: any, idx: number) => (
            <div
              key={idx}
              className="flex flex-col items-center justify-center bg-gray-50 rounded-lg p-4 w-1/3 text-center"
            >
              <Image
                src="/proposal/port.png"
                alt={group.acdc}
                width={40}
                height={40}
                className="mb-2"
              />
              <span
                className="text-gray-700 text-sm font-semibold mt-1"
                dangerouslySetInnerHTML={{
                  __html: `${group.count} ${group.type} ${group.acdc} <br/> Up to ${group.kW} kW`,
                }}
              />
            </div>
          ))}
        </div>
        <FinancialBreakdown station={station} />
        <Timeline station={station} />
        <TokenizationInfo station={station} />
        <InvestmentStats station={station} />
        <InvestButton station={station} />
      </div>
    </div>
  );
}

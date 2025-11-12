import Image from "next/image";

export default function StationHeader({ station, distance }: { station: any; distance: string | null }) {
  return (
    <div>
      <p className="text-sm text-gray-500 font-normal mt-8">
        ChargeFrog Station #{station.proposalId}
      </p>
      <h1 className="text-3xl font-medium text-black mt-3">{station.stationName}</h1>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 text-sm text-gray-700 mt-4">
        <div className="flex items-center gap-1">
          <Image src="/station/location.png" alt="Location" width={18} height={18} />
          <a href={station.googleMapLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 transition mr-1">
            View on Google Map
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Image src="/station/port.png" alt="Port" width={18} height={18} />
          <span className="font-semibold">{station.numberOfPort} Ports</span>
        </div>
        <div className="flex items-center gap-1">
          <Image src="/station/location.png" alt="Distance" width={18} height={18} />
          <span className="font-semibold">{distance ?? "--"}</span>
        </div>
      </div>
    </div>
  );
}

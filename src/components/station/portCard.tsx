import Image from "next/image";
import { applyDiscount } from "@/src/utils/discountHelper";

export default function PortCard({
  port,
  selectedBay,
  setSelectedBay,
  discount,
  idx,
}: any) {
  const discountedPrice = applyDiscount(port.creditPerKWh, 10);

  return (
    <button
      key={idx}
      onClick={() => setSelectedBay(port.bayNumber)}
      className={`w-full text-left flex items-center p-4 rounded-xl border bg-white shadow-sm transition
        ${
          selectedBay === port.bayNumber
            ? "border-[#00dd00] border-2 shadow-md scale-[1.01]"
            : "border-gray-50 hover:border-gray-100"
        }`}
    >
      <span className="text-2xl font-medium text-[#00dd00] mr-2">
        {port.bayNumber}
      </span>
      <Image
        src="/station/port.png"
        alt="Port"
        width={45}
        height={45}
        className="mx-2"
      />
      <div className="flex flex-col flex-1 px-3 space-y-1">
        <span className="font-medium text-lg text-gray-900">{port.type}</span>
        <div className="flex items-center gap-1">
          <Image src="/station/bolt.png" alt="Status" width={12} height={12} />
          <span className="capitalize text-[#00dd00] text-sm font-medium">
            {port.status}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          {port.kW}kW {port.acdc}
        </div>
      </div>
      <div className="text-right min-w-[120px]">
        {!discount ? (
          <div className="flex items-center justify-end gap-1 text-gray-900 font-medium mb-5">
            <span>{port.creditPerKWh}</span>
            <Image
              src="/station/bolt-credit.png"
              alt="Credit"
              width={16}
              height={16}
            />
            <span>/kWh</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end gap-1 text-gray-300 text-sm">
              <span>{port.creditPerKWh}</span>
              <Image
                src="/station/bolt-credit.png"
                alt="Credit"
                width={16}
                height={16}
              />
              <span>/kWh</span>
            </div>
            <div className="flex items-center justify-end gap-1 text-gray-900 font-semibold text-md mt-2">
              <span>{discountedPrice}</span>
              <Image
                src="/station/bolt-credit.png"
                alt="Discounted Credit"
                width={16}
                height={16}
              />
              <span>/kWh</span>
            </div>
          </>
        )}
      </div>
    </button>
  );
}

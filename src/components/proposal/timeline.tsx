"use client";

interface Station {
  timeline: {
    startDate: string;
    goLiveDate: string;
  };
}

export default function Timeline({ station }: { station: Station }) {
  return (
    <div className="mt-8">
      {/* --- Title --- */}
      <h2 className="text-xl font-medium text-gray-900 mb-4">Timeline</h2>

      {/* --- Timeline Box --- */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl py-10 flex flex-col items-center relative">
        <div className="relative flex flex-col items-center w-full">
          {/* Top Date */}
          <div className="text-center mb-2">
            <p className="text-gray-600 text-sm font-medium">
              Estimated Start Date
            </p>
            <p className="text-black font-semibold">
              {station.timeline.startDate}
            </p>
          </div>

          {/* Line + Text */}
          <div className="relative w-full flex justify-center">
            {/* The green line */}
            <div className="w-0.5 bg-[#00dd00] h-40 relative z-0"></div>

            {/* The middle text */}
            <div className="absolute top-1/2 left-0 w-full text-center z-10">
              <div className="inline-block bg-white px-3 text-gray-600 text-sm font-medium">
                3 months setup duration
              </div>
            </div>

            {/* The two dots */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#00dd00] rounded-full"></div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#00dd00] rounded-full"></div>
          </div>

          {/* Bottom Date */}
          <div className="text-center mt-2">
            <p className="text-gray-600 text-sm font-medium">
              Estimated Go-Live Date
            </p>
            <p className="text-black font-semibold">
              {station.timeline.goLiveDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

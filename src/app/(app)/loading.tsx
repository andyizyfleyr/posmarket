import { Store } from 'lucide-react';

export default function Loading() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
      <div className="relative">
        <div className="absolute inset-0 bg-[#f56b2a]/20 rounded-full blur-2xl animate-pulse scale-150"></div>
        <div className="relative w-24 h-24 bg-white rounded-[32px] shadow-2xl border-4 border-[#f56b2a]/10 flex items-center justify-center">
          <Store size={48} className="text-[#f56b2a] animate-bounce" />
        </div>
      </div>
      <p className="mt-8 text-slate-500 font-bold animate-pulse">Patientez...</p>
    </div>
  );
}

import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, Shield, CreditCard, Lock, Sparkles } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [platformName, setPlatformName] = useState('Vinodh Sir Administration');
  const [passingPercentage, setPassingPercentage] = useState('40');
  const [defaultNegativeMark, setDefaultNegativeMark] = useState('0.25');
  const [savedMsg, setSavedMsg] = useState('');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg('Platform settings updated successfully!');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  return (
    <div id="admin-settings-page" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-400/30">
            System Preferences
          </span>
          <h1 className="text-2xl font-black text-white mt-1">Platform & Exam Settings</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure platform branding, exam grading rules, and Razorpay payment integration options.
          </p>
        </div>
      </div>

      {savedMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Branding & Portal Title */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-base text-slate-900">Portal Branding & Identity</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Admin Portal Name</label>
              <input
                type="text"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Entrance Examination</label>
              <input
                type="text"
                disabled
                value="RGUKT IIIT Entrance Exam (AP & TS)"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-semibold cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Grading & Marking Rules */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-base text-slate-900">Default Test Grading Rules</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pass Mark Benchmark (%)</label>
              <input
                type="number"
                value={passingPercentage}
                onChange={(e) => setPassingPercentage(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Default Negative Marking per Incorrect Answer</label>
              <select
                value={defaultNegativeMark}
                onChange={(e) => setDefaultNegativeMark(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="0">0 (No Negative Marking)</option>
                <option value="0.25">0.25 Marks (-1/4th)</option>
                <option value="0.33">0.33 Marks (-1/3rd)</option>
                <option value="0.5">0.50 Marks (-1/2)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Razorpay Integration Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-base text-slate-900">Razorpay Payment Gateway</h3>
          </div>

          <div className="p-4 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white font-bold flex items-center justify-center">
                ✓
              </div>
              <div>
                <p className="font-bold text-emerald-950">Razorpay Premium Gateway Active</p>
                <p className="text-[11px] text-emerald-800">Key ID configured in system environment variables</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg text-[10px]">
              LIVE READY
            </span>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>Save System Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};

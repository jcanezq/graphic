"use client";

import dynamic from "next/dynamic";

const DashboardCharts = dynamic(() => import("./DashboardCharts"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 360, borderRadius: 14 }} />,
});

export default DashboardCharts;

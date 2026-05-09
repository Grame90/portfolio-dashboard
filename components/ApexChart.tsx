"use client";
import dynamic from "next/dynamic";

// ApexCharts uses window — must be loaded client-side only
const ApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <div style={{ height: "100%", minHeight: 120 }} />,
});

export default ApexChart;

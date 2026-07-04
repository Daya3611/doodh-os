'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import { RateChart } from '@/types';
import { format } from 'date-fns';
import { MoreHorizontal, Eye, Copy, Trash, CheckCircle2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

interface RateChartTableProps {
  charts: RateChart[];
  onActivate: (chart: RateChart) => void;
  onDelete: (chart: RateChart) => void;
  onDuplicate: (chart: RateChart) => void;
}

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '16px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

export default function RateChartTable({ charts, onActivate, onDelete, onDuplicate }: RateChartTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = [
    {
      accessorKey: 'version',
      header: 'Version Name',
      cell: ({ row }: any) => {
        const chart = row.original;
        return (
          <div>
            <div className="font-bold text-[#111]">{chart.version}</div>
            <div className="text-[11px] text-[#888] mt-0.5">ID: {chart.id.slice(0, 8)}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'animal',
      header: 'Animal',
      cell: ({ row }: any) => {
        const animal = row.original.animal;
        return (
          <span className={`text-[12px] font-bold px-2.5 py-1 rounded-md capitalize ${
            animal === 'cow' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
          }`}>
            {animal}
          </span>
        );
      },
    },
    {
      accessorKey: 'effectiveFrom',
      header: 'Effective From',
      cell: ({ row }: any) => {
        if (!row.original.effectiveFrom) return <div className="text-[13px] font-medium text-[#444]">Legacy</div>;
        const date = row.original.effectiveFrom?.toDate?.() || new Date(row.original.effectiveFrom);
        if (isNaN(date.getTime())) return <div className="text-[13px] font-medium text-[#444]">Invalid Date</div>;
        return <div className="text-[13px] font-medium text-[#444]">{format(date, 'dd MMM yyyy')}</div>;
      },
    },
    {
      accessorKey: 'effectiveUntil',
      header: 'Effective Until',
      cell: ({ row }: any) => {
        const date = row.original.effectiveUntil;
        if (!date) return <div className="text-[13px] font-medium text-[#444]">Current</div>;
        const d = date.toDate?.() || new Date(date);
        return <div className="text-[13px] font-medium text-[#444]">{format(d, 'dd MMM yyyy')}</div>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.original.status;
        let style = '';
        switch (status) {
          case 'active': style = 'bg-green-100 text-green-700'; break;
          case 'upcoming': style = 'bg-blue-100 text-blue-700'; break;
          case 'expired': style = 'bg-gray-100 text-gray-700'; break;
          case 'draft': style = 'bg-orange-100 text-orange-700'; break;
          case 'archived': style = 'bg-red-100 text-red-700'; break;
        }
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wide ${style}`}>
            {status === 'active' && <CheckCircle2 size={12}/>}
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: 'totalEntries',
      header: 'Entries',
      cell: ({ row }: any) => (
        <div className="text-[13px] font-medium text-[#444]">{row.original.totalEntries || '-'}</div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => {
        const chart = row.original;
        return (
          <div className="flex justify-end pr-4">
            <DropdownMenu>
              <DropdownMenuTrigger className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100 text-slate-500">
                <MoreHorizontal size={16} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-xs text-slate-400 font-normal uppercase tracking-wider">Actions</div>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem className="text-[13px] gap-2 cursor-pointer font-medium" onClick={() => router.push(`/rate-chart/${chart.id}`)}>
                  <Eye size={14} /> View Matrix
                </DropdownMenuItem>

                {chart.status === 'upcoming' && (
                  <DropdownMenuItem className="text-[13px] gap-2 cursor-pointer font-medium text-green-600 focus:text-green-600 focus:bg-green-50" onClick={() => onActivate(chart)}>
                    <CheckCircle2 size={14} /> Make Active Now
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem className="text-[13px] gap-2 cursor-pointer font-medium" onClick={() => onDuplicate(chart)}>
                  <Copy size={14} /> Duplicate Chart
                </DropdownMenuItem>
                
                {chart.status !== 'active' && (
                  <DropdownMenuItem className="text-[13px] gap-2 cursor-pointer font-medium text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => onDelete(chart)}>
                    <Trash size={14} /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: charts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div style={cardStyle} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-6 py-4 text-[11px] font-bold text-[#888] uppercase tracking-wider">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[#888] text-[13px]">
                  No rate charts found. Start by importing a new matrix.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-[#F7F7F7] hover:bg-[#FDFDFD] transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="px-6 py-4 flex items-center justify-between border-t border-[#F0F0F0] bg-[#FAFAFA]">
          <div className="text-[12px] text-[#777]">
            Showing {table.getRowModel().rows.length} of {charts.length} charts
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1.5 text-[12px] font-medium border border-[#E0E0E0] rounded-md disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1.5 text-[12px] font-medium border border-[#E0E0E0] rounded-md disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

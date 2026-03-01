'use client'

import { MainLayout } from '@/components/layout/mainlayout'
import { Header } from '@/components/navigation/header'
import { Sidebar } from '@/components/navigation/sidebar'

import { useState } from 'react'

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {


  return (
    <MainLayout role="JR CRM">
      {children}
    </MainLayout>
  )
}

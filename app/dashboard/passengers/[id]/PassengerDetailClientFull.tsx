'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
    ArrowLeft, Pencil, AlertCircle, ExternalLink, Users, Phone, Mail,
    MapPin, School as SchoolIcon, Bus, CheckCircle, Clock,
    AlertTriangle, MessageSquare, StickyNote, Plus, Trash2, Edit2
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import AddParentContactSection from './AddParentContactSection'
import RemoveParentContactButton from './RemoveParentContactButton'
import EditSENRequirementsSection from './EditSENRequirementsSection'
import AddIncidentSection from './AddIncidentSection'
import IncidentDocumentUpload from './IncidentDocumentUpload'
import PassengerDetailClient from './PassengerDetailClient'

interface Passenger {
    id: number
    full_name: string
    dob: string
    gender: string
    address: string
    important_notes: string
    sen_requirements: string
    school_id: number
    mobility_type: string
    route_id: number
    seat_number: string
    personal_item: string
    supervision_type: string
    schools?: { name: string }
    routes?: { route_number: string }
}

interface Props {
    passenger: Passenger
    incidents: any[]
    parentContacts: any[]
}

export default function PassengerDetailClientFull({ passenger, incidents, parentContacts }: Props) {

    return (
        <div className="max-w-[1600px] mx-auto p-4 space-y-6">

            {/* Header Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/passengers">
                        <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg border-2 border-white shadow-sm">
                            {passenger.full_name.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">{passenger.full_name}</h1>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Passenger</span>
                                <span>•</span>
                                <span>ID: {passenger.id}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link href={`/dashboard/passengers/${passenger.id}/edit`}>
                        <Button size="sm" variant="outline" className="h-8 text-xs">
                            <Pencil className="h-3 w-3 mr-1.5" /> Edit Profile
                        </Button>
                    </Link>
                </div>
            </div>

            {passenger.important_notes && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-sm uppercase tracking-wide text-amber-700 mb-1">Important Note</p>
                        <p className="text-sm font-medium">{passenger.important_notes}</p>
                    </div>
                </div>
            )}

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Identity & Logistics (5 cols) */}
                <div className="lg:col-span-5 space-y-4">

                    {/* Basic Info */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Passenger Details</h3>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-y-4 gap-x-2">
                                <div className="col-span-2 space-y-1">
                                    <p className="text-xs text-slate-400">Home Address</p>
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                        <p className="text-sm font-medium text-slate-900">{passenger.address || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-400">Date of Birth</p>
                                    <p className="text-sm font-medium text-slate-900">{formatDate(passenger.dob)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-400">Gender</p>
                                    <p className="text-sm font-medium text-slate-900">{passenger.gender || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-400">Mobility</p>
                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                                        {passenger.mobility_type || 'N/A'}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-400">Supervision</p>
                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                                        {passenger.supervision_type || 'General'}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Journey */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="p-3 border-b bg-slate-50/50">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Journey & Logistics</h3>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                    <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                                        <SchoolIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">School/Destination</p>
                                        <p className="text-sm font-bold text-slate-900">{passenger.schools?.name || 'Unassigned'}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                        <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                                            <Bus className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">Route</p>
                                            <p className="text-sm font-bold text-slate-900">{passenger.routes?.route_number || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                        <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                                            <span className="text-xs font-bold">#</span>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">Seat</p>
                                            <p className="text-sm font-bold text-slate-900">{passenger.seat_number || 'Any'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* SEN Requirements */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SEN Requirements</h3>
                            </div>
                            <div className="p-4">
                                <div className="bg-yellow-50/50 border border-yellow-100 rounded-lg p-3 text-sm text-slate-800">
                                    <EditSENRequirementsSection
                                        passengerId={passenger.id}
                                        currentValue={passenger.sen_requirements}
                                    />
                                    {passenger.sen_requirements ? (
                                        <p className="mt-2 whitespace-pre-wrap">{passenger.sen_requirements}</p>
                                    ) : (
                                        <p className="mt-2 text-slate-400 italic">No specific requirements listed.</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Contacts, Incidents & Updates (7 cols) */}
                <div className="lg:col-span-7 space-y-4">

                    {/* Parent Contacts */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <Users className="h-4 w-4" /> Parent Contacts
                                </h3>
                                <AddParentContactSection passengerId={passenger.id} />
                            </div>

                            {parentContacts.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {parentContacts.map((link: any) => (
                                        <div key={link.id} className="p-3 hover:bg-slate-50 transition-colors flex items-start justify-between group">
                                            <div className="flex items-start gap-4">
                                                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-semibold border border-slate-200">
                                                    {link.parent_contacts?.full_name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-sm font-semibold text-slate-900">{link.parent_contacts?.full_name}</h4>
                                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wide">
                                                            {link.parent_contacts?.relationship || 'Contact'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 space-y-0.5">
                                                        {link.parent_contacts?.phone_number && (
                                                            <p className="text-xs text-slate-600 flex items-center gap-1.5"><Phone className="h-3 w-3" /> {link.parent_contacts.phone_number}</p>
                                                        )}
                                                        {link.parent_contacts?.email && (
                                                            <p className="text-xs text-slate-600 flex items-center gap-1.5"><Mail className="h-3 w-3" /> {link.parent_contacts.email}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link href={`/dashboard/parent-contacts/${link.parent_contacts?.id}`}>
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><ExternalLink className="h-3.5 w-3.5 text-slate-400" /></Button>
                                                </Link>
                                                <RemoveParentContactButton linkId={link.id} contactName={link.parent_contacts?.full_name} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center">
                                    <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">No contacts linked</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Incidents & Updates split */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Incidents */}
                        <Card className="h-full">
                            <CardContent className="p-0 h-full flex flex-col">
                                <div className="p-3 border-b bg-red-50/50 flex justify-between items-center">
                                    <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wider flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" /> Incidents
                                    </h3>
                                    <AddIncidentSection passengerId={passenger.id} passengerRouteId={passenger.route_id} />
                                </div>

                                <div className="flex-1 max-h-[400px] overflow-y-auto">
                                    {incidents.length > 0 ? (
                                        <div className="divide-y divide-slate-100">
                                            {incidents.map((link: any) => {
                                                const i = link.incidents;
                                                if (!i) return null;
                                                return (
                                                    <div key={link.id} className="p-3 hover:bg-slate-50 transition-colors">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${i.resolved ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                                {i.resolved ? 'RESOLVED' : 'OPEN'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">{formatDate(i.reported_at)}</span>
                                                        </div>
                                                        <p className="text-xs font-medium text-slate-800 line-clamp-2 mb-1">{i.description || 'No description'}</p>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] text-slate-500">{i.incident_type}</span>
                                                            <Link href={`/dashboard/incidents/${i.id}`}>
                                                                <Button size="sm" variant="ghost" className="h-auto p-0 text-[10px] text-primary hover:text-primary/90" type="button">View</Button>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center h-full flex flex-col items-center justify-center">
                                            <p className="text-xs text-slate-400">No incidents recorded</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Updates Feed */}
                        <Card className="h-full">
                            <CardContent className="p-0 h-full flex flex-col">
                                <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" /> Updates
                                    </h3>
                                </div>
                                <div className="flex-1">
                                    <PassengerDetailClient passengerId={passenger.id} showOnlyUpdates={true} />
                                </div>
                            </CardContent>
                        </Card>

                    </div>

                </div>
            </div>
        </div>
    )
}

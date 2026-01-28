"use client";

import API_URL from '@/lib/api';
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, Loader2, FileArchive, CalendarIcon, FileSpreadsheet, FileText, Play } from "lucide-react"; // เพิ่ม Play
import { toast } from "sonner";

// --- Types สำหรับ Location ---
interface Province {
  adm1_name: string;
  adm1_pcode: string;
}

interface District {
  adm2_name: string;
  adm2_pcode: string;
}

// Config สำหรับ Field ทั่วไป (ใช้ใน Single Entry)
const GENERAL_FIELDS = [
  { key: "patient_id", label: "Patient ID", placeholder: "e.g. 9, 10, 11", type: "text" },
  { key: "sample_id", label: "Sample ID", placeholder: "e.g. ERR718192", type: "text" },
  { key: "sex", label: "Sex", type: "select", options: ["Male", "Female"] },
  { key: "age", label: "Age", placeholder: "e.g. 58", type: "number" },
  { key: "ethnic_group", label: "Ethnic Group", placeholder: "e.g. Lahu, Thailand", type: "text" },
  { key: "education", label: "Education", placeholder: "e.g. No formal education", type: "text" },
  { key: "occupation", label: "Occupation", placeholder: "e.g. Unemployed", type: "text" },
  { key: "chest_x_ray", label: "Chest X-ray", placeholder: "e.g. Cavity", type: "text" },
  { key: "treatment_outcome", label: "Treatment Outcome", placeholder: "e.g. Cure/complete", type: "text" },
];

export default function UploadPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  
  // --- New State: Tab Management ---
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");

  // State สำหรับเก็บไฟล์ .gz (ใช้ร่วมกันทั้ง 2 โหมด)
  const [files, setFiles] = useState<File[]>([]);
  
  // --- New State: Excel File ---
  const [excelFile, setExcelFile] = useState<File | null>(null);
  
  // State ข้อมูล Form (Single Entry)
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  
  // State สำหรับ Dropdown Location
  const [provinceList, setProvinceList] = useState<Province[]>([]);
  const [districtList, setDistrictList] = useState<District[]>([]);
  const [selectedPcode, setSelectedPcode] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null); // สำหรับ .gz
  const excelInputRef = useRef<HTMLInputElement>(null); // สำหรับ .xlsx

  const [showRunModal, setShowRunModal] = useState(false);
  const [previewSamples, setPreviewSamples] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // --- 1. Fetch Provinces ---
  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const token = sessionStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/upload/provinces`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setProvinceList(data);
        }
      } catch (error) {
        console.error("Failed to fetch provinces", error);
        setProvinceList([
            { adm1_name: "Chiang Rai", adm1_pcode: "TH57" },
            { adm1_name: "Chiang Mai", adm1_pcode: "TH50" }
        ]);
      }
    };
    fetchProvinces();
  }, []);

  // --- 2. Fetch Districts ---
  useEffect(() => {
    if (!selectedPcode) {
      setDistrictList([]);
      return;
    }

    const fetchDistricts = async () => {
      setIsLocationLoading(true);
      try {
        const token = sessionStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/upload/districts?pcode=${selectedPcode}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDistrictList(data);
        }
      } catch (error) {
        console.error("Failed to fetch districts", error);
        setDistrictList([{ adm2_name: "Other District", adm2_pcode: "9999" }]);
      } finally {
        setIsLocationLoading(false);
      }
    };
    fetchDistricts();
  }, [selectedPcode]);

  // --- Helpers & Handlers ---

  const formatDateForSubmit = (isoDate: string): string => {
    if (!isoDate) return "NA";
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const provinceObj = provinceList.find(p => p.adm1_name === selectedName);
    setMetadata(prev => ({ ...prev, province: selectedName, district: "" }));
    setSelectedPcode(provinceObj ? provinceObj.adm1_pcode : "");
  };

  // --- File Handlers (.gz) ---
  const handleFiles = (fileList: FileList) => {
    if (fileList && fileList.length > 0) {
      const selectedFiles = Array.from(fileList);
      const validFiles = selectedFiles.filter(file => file.name.toLowerCase().endsWith('.gz'));
      
      if (validFiles.length < selectedFiles.length) {
        toast.warning(`Skipped non-.gz files`);
      }

      // --- LOGIC: Limit files for Single Entry ---
      if (activeTab === "single") {
        if (files.length + validFiles.length > 2) {
          toast.error("Single Entry mode allows a maximum of 2 .gz files.");
          return;
        }
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Excel Handlers ---
  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validExtensions = ['.xlsx', '.xls'];
      if (validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        setExcelFile(file);
      } else {
        toast.error("Please upload a valid Excel file (.xlsx, .xls)");
      }
    }
    if (excelInputRef.current) excelInputRef.current.value = "";
  };

  const removeExcelFile = () => setExcelFile(null);

  // --- Drag & Drop Logic ---
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (!isLoading) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    if (isLoading) return;
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    // ถ้าไฟล์ถูกลบ ต้องเคลียร์ค่าใน metadata ของ fastq ด้วยเพื่อป้องกันข้อมูลผิดพลาด
    const fileToRemove = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    
    // Optional: Clear selection if the removed file was selected
    if(activeTab === "single") {
        setMetadata(prev => {
            const newState = { ...prev };
            if (newState.fastq_1 === fileToRemove.name) newState.fastq_1 = "";
            if (newState.fastq_2 === fileToRemove.name) newState.fastq_2 = "";
            return newState;
        });
    }
  };

  // --- MAIN SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (files.length === 0) {
      toast.error("กรุณาอัปโหลดไฟล์ .gz อย่างน้อย 1 ไฟล์");
      return;
    }

    const formData = new FormData();
    const token = sessionStorage.getItem('token');

    // แยก Logic ตาม Tab
    if (activeTab === "single") {
        // Validate required fields
        if(!metadata.patient_id || !metadata.sample_id) {
            toast.error("กรุณากรอก Patient ID และ Sample ID");
            return;
        }
        if(!metadata.fastq_1 || !metadata.fastq_2) {
            toast.error("กรุณาเลือกไฟล์ FastQ 1 และ FastQ 2");
            return;
        }
        if(metadata.fastq_1 === metadata.fastq_2) {
            toast.error("FastQ File 1 และ FastQ File 2 ต้องไม่เหมือนกัน");
            return;
        }

        const metadataToSubmit = {
            ...metadata,
            collection_date: formatDateForSubmit(metadata.collection_date || ""),
        };
        formData.append("mode", "single");
        formData.append("metadata", JSON.stringify(metadataToSubmit));
    } else {
        // Batch Mode
        if (!excelFile) {
            toast.error("กรุณาอัปโหลดไฟล์ Excel (Metadata)");
            return;
        }
        
        formData.append("mode", "batch");
        formData.append("excel", excelFile);
    }

    // Append .gz files for both modes
    files.forEach((file) => formData.append("files", file));      

    setIsLoading(true);

    try {
      if(activeTab === "single") {
        console.log(formData.get("metadata"));
        
        const response = await fetch(`${API_URL}/api/upload/single`, {
          method: "POST",
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Upload failed");
        }
  
        const result = await response.json();
        toast.success(result.message || "Upload successful!");
        
        // Reset Form
        setMetadata({});
        setFiles([]);
        setExcelFile(null);
        setSelectedPcode("");
        setDistrictList([]);
      } else if(activeTab === "batch") {        
        const response = await fetch(`${API_URL}/api/upload/batch`, {
          method: "POST",
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        if (response.ok) {
          const result = await response.json();
          console.log(result);
          toast.success(result.message || "Batch upload successful!");
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Upload failed");
        }
      }

    } catch (error: Error | unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Something went wrong";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenRunModal = async () => {
      try {
          const token = sessionStorage.getItem('token');
          const res = await fetch(`${API_URL}/api/upload/run/preview`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${token}` },
          });
          if (res.ok) {
              const data = await res.json();
              setPreviewSamples(data.samples || []);
              setShowRunModal(true);
          } else {
              toast.error("Failed to load preview data");
          }
      } catch (error) {
          console.error(error);
          toast.error("Error connecting to server");
      }
  };

  const handleExecuteRun = async () => {
      setIsRunning(true);
      try {
          const token = sessionStorage.getItem('token');
          const res = await fetch(`${API_URL}/api/upload/run/execute`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
          });
          
          if (res.ok) {
              const result = await res.json();
              toast.success(`Pipeline started! (ID: ${result.run_id})`);

              try {
                const emailRes = await fetch(`${API_URL}/api/email/send`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    to: "peemppk5538@gmail.com",
                    subject: "MTB-Cluster Web: Processing Started",
                    text:
                      `Your MTB-Cluster file processing has started successfully.` +
                      `${result?.run_id ? `\n\nRun ID: ${result.run_id}` : ""}` +
                      `\n\nYou can check progress and download results from the Download tab once processing is complete.`,
                  }),
                });
                if (!emailRes.ok) {
                  toast.error("Pipeline started, but email notification failed.");
                }
              } catch {
                toast.error("Pipeline started, but email notification failed.");
              }
              
              // Close Modal & Reset Form (เพราะไฟล์ถูกย้ายไปแล้ว)
              setShowRunModal(false);
              setFiles([]);
              setMetadata({});
              setExcelFile(null);
              // อาจจะ refresh preview ใหม่เพื่อให้ list ว่างเปล่า
              setPreviewSamples([]); 
          } else {
              const err = await res.json();
              toast.error(err.message || "Failed to start process");
          }
      } catch (error) {
          console.error(error);
          toast.error("Something went wrong");
      } finally {
          setIsRunning(false);
      }
  };

  // Styles
  const labelStyle = "text-sm font-semibold mb-1.5 block text-slate-700";
  const inputStyle = "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all";
  const buttonStyle = "inline-flex items-center justify-center rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 h-10 px-4 py-2 w-full disabled:opacity-50 transition-colors cursor-pointer shadow-sm";
  const tabActive = "bg-slate-900 text-white shadow-sm";
  const tabInactive = "bg-white text-slate-600 hover:bg-slate-100";

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6 text-slate-900">Patient Data Entry</h1>
      
      {/* --- [แก้ไขจุดที่ 1] Tab Navigation & Top Action Bar --- */}
      <div className="flex flex-col sm:flex-row justify-between items-end mb-6 max-w-6xl mx-auto gap-4">
        
        {/* Left: Tabs */}
        <div className="flex space-x-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setActiveTab("single");
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "single" ? tabActive : tabInactive}`}
          >
              <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Single Entry
              </div>
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "batch" ? tabActive : tabInactive}`}
          >
              <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Batch Upload (Excel)
              </div>
          </button>
        </div>

        {/* Right: Run Process Button (ย้ายมาตรงนี้) */}
        <button 
            type="button" 
            onClick={handleOpenRunModal}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 h-10 px-6 py-2 transition-colors shadow-sm w-full sm:w-auto"
        >
            <Play className="h-4 w-4 mr-2" /> Run Process
        </button>
      </div>

      <Card className="w-full max-w-6xl mx-auto shadow-lg border-slate-200">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-xl flex items-center gap-2">
            {activeTab === "single" ? "Single Metadata Entry" : "Batch Metadata Upload"} & Files
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* --- PART 1: METADATA INPUT --- */}
            
            {activeTab === "single" ? (
              /* SINGLE ENTRY FORM */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
                {/* Loop General Fields */}
                {GENERAL_FIELDS.slice(0, 2).map((field) => (
                   <div key={field.key}>
                      <label className={labelStyle}>{field.label} <span className="text-red-500">*</span></label>
                      <input 
                        type={field.type} 
                        name={field.key} 
                        value={metadata[field.key] || ""} 
                        onChange={handleInputChange} 
                        className={inputStyle} 
                        placeholder={field.placeholder}
                        disabled={isLoading}
                      />
                   </div>
                ))}

                {/* FastQ 1 */}
                <div>
                   <label className={labelStyle}>FastQ File 1 <span className="text-red-500">*</span></label>
                   <div className="relative">
                      <select 
                          name="fastq_1" 
                          value={metadata.fastq_1 || ""} 
                          onChange={handleInputChange}
                          className={`${inputStyle} appearance-none cursor-pointer`}
                          disabled={isLoading || files.length === 0}
                      >
                          <option value="">
                              {files.length === 0 ? "Upload .gz files first" : "Select File 1"}
                          </option>
                          {files.map((f, idx) => (
                              <option key={`f1-${idx}`} value={f.name}>{f.name}</option>
                          ))}
                      </select>
                   </div>
                </div>

                {/* FastQ 2 */}
                <div>
                   <label className={labelStyle}>FastQ File 2 <span className="text-red-500">*</span></label>
                   <div className="relative">
                      <select 
                          name="fastq_2" 
                          value={metadata.fastq_2 || ""} 
                          onChange={handleInputChange}
                          className={`${inputStyle} appearance-none cursor-pointer`}
                          disabled={isLoading || files.length === 0}
                      >
                          <option value="">
                              {files.length === 0 ? "Upload .gz files first" : "Select File 2"}
                          </option>
                          {files.map((f, idx) => (
                              <option key={`f2-${idx}`} value={f.name}>{f.name}</option>
                          ))}
                      </select>
                   </div>
                </div>
                
                {/* Date */}
                <div>
                   <label className={labelStyle}>Collection Date</label>
                   <div className="relative">
                      <input 
                          type="date" 
                          name="collection_date"
                          value={metadata.collection_date || ""} 
                          onChange={handleInputChange} 
                          className={`${inputStyle} cursor-pointer`} 
                          disabled={isLoading}
                      />
                      {!metadata.collection_date && (
                          <CalendarIcon className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                      )}
                   </div>
                </div>

                {/* Province */}
                <div>
                   <label className={labelStyle}>Province</label>
                   <div className="relative">
                      <select 
                          name="province" 
                          value={metadata.province || ""} 
                          onChange={handleProvinceChange}
                          className={`${inputStyle} appearance-none cursor-pointer`}
                          disabled={isLoading}
                      >
                          <option value="">Select Province</option>
                          {provinceList.map((prov) => (
                              <option key={prov.adm1_pcode} value={prov.adm1_name}>{prov.adm1_name}</option>
                          ))}
                      </select>
                   </div>
                </div>

                {/* District */}
                <div>
                   <label className={labelStyle}>District</label>
                   <div className="relative">
                      <select 
                          name="district" 
                          value={metadata.district || ""} 
                          onChange={handleInputChange}
                          className={`${inputStyle} appearance-none cursor-pointer`}
                          disabled={isLoading || !selectedPcode}
                      >
                          <option value="">
                              {isLocationLoading ? "Loading..." : "Select District"}
                          </option>
                          {districtList.map((dist) => (
                              <option key={dist.adm2_pcode} value={dist.adm2_name}>{dist.adm2_name}</option>
                          ))}
                           <option value="NA">NA</option>
                      </select>
                   </div>
                </div>

                {/* Remaining Fields */}
                {GENERAL_FIELDS.slice(2).map((field) => (
                   <div key={field.key}>
                      <label className={labelStyle}>{field.label}</label>
                      {field.type === 'select' ? (
                          <div className="relative">
                              <select 
                                  name={field.key} 
                                  value={metadata[field.key] || ""} 
                                  onChange={handleInputChange} 
                                  className={`${inputStyle} appearance-none`}
                                  disabled={isLoading}
                              >
                                  <option value="">Select...</option>
                                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                          </div>
                      ) : (
                          <input 
                              type={field.type} 
                              name={field.key} 
                              value={metadata[field.key] || ""} 
                              onChange={handleInputChange} 
                              className={inputStyle} 
                              placeholder={field.placeholder}
                              disabled={isLoading}
                          />
                      )}
                   </div>
                ))}
              </div>
            ) : (
              /* BATCH UPLOAD (EXCEL) FORM */
              <div className="animate-in fade-in duration-300">
                <div className="bg-emerald-50 p-6 rounded-lg border border-dashed border-emerald-300 mb-6">
                    <label className="text-base font-semibold mb-4 block text-emerald-800 flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" /> Upload Metadata Excel <span className="text-red-500">*</span>
                    </label>

                    {!excelFile ? (
                        <div 
                            onClick={() => !isLoading && excelInputRef.current?.click()}
                            className="bg-white border-2 border-dashed border-emerald-200 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all"
                        >
                            <FileSpreadsheet className="h-10 w-10 text-emerald-400 mb-2" />
                            <p className="text-sm text-emerald-600 font-medium">Click to upload .xlsx or .xls file</p>
                            <input 
                                type="file" 
                                accept=".xlsx, .xls" 
                                className="hidden" 
                                ref={excelInputRef} 
                                onChange={handleExcelChange} 
                                disabled={isLoading} 
                            />
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 border border-emerald-200 rounded-md bg-white shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-100 p-2 rounded text-emerald-600">
                                    <FileSpreadsheet className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-700">{excelFile.name}</p>
                                    <p className="text-xs text-slate-500">{(excelFile.size / 1024).toFixed(2)} KB</p>
                                </div>
                            </div>
                            <button type="button" onClick={removeExcelFile} disabled={isLoading} className="text-slate-400 hover:text-red-500 p-2">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                    <p className="text-xs text-emerald-600 mt-2">
                        * Ensure the Excel file contains columns matching the metadata fields (e.g., patient_id, sample_id).
                    </p>
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 my-4"></div>

            {/* --- PART 2: GZ FILES UPLOAD (SHARED) --- */}
            <div className="bg-slate-50 p-6 rounded-lg border border-dashed border-slate-300">
              <label className="text-base font-semibold mb-4 block text-slate-800">
                Sequencing Files Upload (.gz) <span className="text-red-500">*</span>
                {activeTab === "single" && <span className="text-xs font-normal text-slate-500 ml-2">(Max 2 files for Single Entry)</span>}
              </label>
              
              <div 
                onClick={() => !isLoading && fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                  bg-white border-2 border-dashed  rounded-lg p-10 
                  flex flex-col items-center justify-center cursor-pointer 
                  hover:border-slate-500 hover:bg-slate-50 transition-all duration-200
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isDragging ? 'border-slate-600 bg-slate-100' : 'border-slate-300'}
                `}
              >
                <Upload className="h-12 w-12 text-slate-400 mb-3" />
                <p className="text-sm text-slate-600 font-medium">Click or drag & drop to select .gz files</p>
                <p className="text-xs text-slate-400 mt-1">Supports multiple files upload</p>
                <input type="file" multiple accept=".gz" className="hidden" ref={fileInputRef} onChange={handleFileChange} disabled={isLoading} />
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-4">
                    <p className="text-sm font-medium text-slate-700 mb-2">Selected Files ({files.length})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
                    {files.map((f, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border border-slate-200 rounded-md bg-white shadow-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="bg-orange-50 p-2 rounded text-orange-600"><FileArchive className="h-5 w-5" /></div>
                            <span className="truncate font-medium text-slate-700 text-sm">{f.name}</span>
                        </div>
                        <button type="button" onClick={() => removeFile(index)} disabled={isLoading} className="text-slate-400 hover:text-red-600 p-2"><X className="h-5 w-5" /></button>
                        </div>
                    ))}
                    </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
                <button type="submit" className={buttonStyle} disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...</> : 
                    activeTab === "single" ? "Submit Data & Files" : "Process Batch Upload"
                  }
                </button>
            </div>
            
            {/* [แก้ไขจุดที่ 2] ลบส่วนปุ่ม Run ด้านล่างนี้ออกไปแล้ว */}

          </form>
        </CardContent>
      </Card>

      {/* --- MODAL (คงเดิม) --- */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Play className="h-4 w-4 text-emerald-600" /> Run Process Pipeline
                    </h3>
                    <button onClick={() => setShowRunModal(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="p-6">
                    <p className="text-sm text-slate-600 mb-3">
                        The following <strong>{previewSamples.length} samples</strong> will be moved to the processing engine:
                    </p>
                    
                    <div className="bg-slate-50 border rounded-md p-3 max-h-60 overflow-y-auto mb-6">
                        {previewSamples.length > 0 ? (
                            <ul className="space-y-1">
                                {previewSamples.map((id, idx) => (
                                    <li key={idx} className="text-sm text-slate-700 border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                                        • {id}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-400 italic text-center py-4">No samples found in staging.</p>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button 
                            onClick={() => setShowRunModal(false)}
                            className="px-4 py-2 rounded-md text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
                            disabled={isRunning}
                        >
                            Close
                        </button>
                        <button 
                            onClick={handleExecuteRun}
                            disabled={isRunning || previewSamples.length === 0}
                            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {isRunning ? "Starting..." : "Run Process"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
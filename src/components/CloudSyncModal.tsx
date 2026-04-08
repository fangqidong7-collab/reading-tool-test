"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { BookOpen, Upload, Download, Copy, Check, AlertCircle, Cloud } from "lucide-react";

interface CloudSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SyncStatus = "idle" | "uploading" | "downloading" | "success" | "error";

interface SyncResult {
  syncCode?: string;
  data?: string;
  dataSize?: number;
  bookCount?: number;
  error?: string;
}

export function CloudSyncModal({ open, onOpenChange }: CloudSyncModalProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "download">("upload");
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);

  // 收集所有本地数据
  const collectLocalData = (): string => {
    const data: Record<string, unknown> = {};

    // 收集 localStorage 中的应用数据
    const keys = [
      "bookshelf",
      "reading-settings",
      "bookmarks",
      "annotations",
      "processed-content",
      "external-dict-cache",
      "last-sync-code",
    ];

    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    }

    return JSON.stringify(data);
  };

  // 解析云端数据
  const parseCloudData = (cloudDataStr: string): Record<string, unknown> => {
    try {
      return JSON.parse(cloudDataStr);
    } catch {
      throw new Error("数据格式无效");
    }
  };

  // 统计书籍数量
  const countBooks = (data: Record<string, unknown>): number => {
    const bookshelf = data.bookshelf;
    if (typeof bookshelf === "object" && bookshelf !== null) {
      const books = (bookshelf as Record<string, unknown>).books;
      if (Array.isArray(books)) {
        return books.length;
      }
    }
    return 0;
  };

  // 上传数据
  const handleUpload = async () => {
    setStatus("uploading");
    setResult(null);

    try {
      const localData = collectLocalData();
      
      // 检查是否有数据
      const parsedData = parseCloudData(localData);
      if (Object.keys(parsedData).length === 0) {
        setStatus("error");
        setResult({ error: "没有找到可同步的数据" });
        return;
      }

      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: localData }),
      });

      const resData = await response.json();

      if (!response.ok) {
        setStatus("error");
        setResult({ error: resData.error || "上传失败" });
        return;
      }

      // 保存同步码到本地
      localStorage.setItem("last-sync-code", resData.syncCode);

      setStatus("success");
      setResult({
        syncCode: resData.syncCode,
        dataSize: resData.dataSize,
        bookCount: countBooks(parsedData),
      });
    } catch (err) {
      setStatus("error");
      setResult({ error: err instanceof Error ? err.message : "上传失败" });
    }
  };

  // 下载数据
  const handleDownload = async () => {
    if (!inputCode.trim()) {
      setStatus("error");
      setResult({ error: "请输入同步码" });
      return;
    }

    setStatus("downloading");
    setResult(null);

    try {
      const response = await fetch(`/api/sync?code=${inputCode.trim()}`);

      const resData = await response.json();

      if (!response.ok) {
        setStatus("error");
        setResult({ error: resData.error || "同步码无效" });
        return;
      }

      // 解析云端数据
      const cloudData = parseCloudData(resData.data);

      // 统计书籍数量
      const bookCount = countBooks(cloudData);

      setStatus("success");
      setResult({
        data: resData.data,
        bookCount: bookCount,
      });
    } catch (err) {
      setStatus("error");
      setResult({ error: err instanceof Error ? err.message : "下载失败" });
    }
  };

  // 确认恢复数据
  const handleConfirmRestore = () => {
    if (!result?.data) return;

    try {
      const cloudData = parseCloudData(result.data as string);

      // 写入 localStorage
      for (const [key, value] of Object.entries(cloudData)) {
        localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      }

      // 关闭弹窗并刷新页面
      onOpenChange(false);
      window.location.reload();
    } catch (err) {
      setStatus("error");
      setResult({ error: "恢复数据失败: " + (err instanceof Error ? err.message : "未知错误") });
    }
  };

  // 复制同步码
  const handleCopyCode = async () => {
    if (!result?.syncCode) return;

    try {
      await navigator.clipboard.writeText(result.syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = result.syncCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // 重置状态
  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setResult(null);
      setInputCode("");
      setCopied(false);
      setActiveTab("upload");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            云同步
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "download")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-1.5">
              <Upload className="h-4 w-4" />
              上传备份
            </TabsTrigger>
            <TabsTrigger value="download" className="flex items-center gap-1.5">
              <Download className="h-4 w-4" />
              恢复数据
            </TabsTrigger>
          </TabsList>

          {/* 上传标签页 */}
          <TabsContent value="upload" className="space-y-4">
            {status === "idle" && (
              <>
                <p className="text-sm text-muted-foreground">
                  点击下方按钮，将您当前设备的所有数据（书架、标注、书签、阅读进度）上传到云端。
                </p>
                <Button onClick={handleUpload} className="w-full">
                  <Upload className="mr-2 h-4 w-4" />
                  生成同步码并上传
                </Button>
              </>
            )}

            {status === "uploading" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Spinner />
                <p className="text-sm text-muted-foreground">正在上传数据...</p>
              </div>
            )}

            {status === "success" && result?.syncCode && (
              <div className="space-y-4">
                <Alert className="border-green-500 bg-green-50">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    上传成功！您的数据已同步到云端。
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>您的同步码</Label>
                  <div className="flex gap-2">
                    <Input
                      value={result.syncCode}
                      readOnly
                      className="font-mono text-lg tracking-wider font-bold"
                    />
                    <Button variant="outline" onClick={handleCopyCode} className="shrink-0">
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <p>包含 {result.bookCount} 本书籍</p>
                  <p>数据大小：{result.dataSize && formatSize(result.dataSize)}</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <p className="font-medium">请妥善保存此同步码</p>
                  <p className="text-amber-700">在其他设备上输入此同步码即可恢复数据</p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <Alert className="border-red-500 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {result?.error || "上传失败，请重试"}
                  </AlertDescription>
                </Alert>
                <Button onClick={() => setStatus("idle")} variant="outline" className="w-full">
                  重新上传
                </Button>
              </div>
            )}
          </TabsContent>

          {/* 下载标签页 */}
          <TabsContent value="download" className="space-y-4">
            {status === "idle" && (
              <>
                <p className="text-sm text-muted-foreground">
                  输入在其他设备上获取的同步码，即可恢复云端保存的数据。
                </p>
                <div className="space-y-2">
                  <Label htmlFor="syncCode">同步码</Label>
                  <Input
                    id="syncCode"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="例如：A3K9M2X7"
                    maxLength={8}
                    className="font-mono text-lg tracking-wider font-bold uppercase"
                  />
                </div>
                <Button onClick={handleDownload} className="w-full" disabled={inputCode.length !== 8}>
                  <Download className="mr-2 h-4 w-4" />
                  恢复数据
                </Button>
              </>
            )}

            {status === "downloading" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Spinner />
                <p className="text-sm text-muted-foreground">正在查询云端数据...</p>
              </div>
            )}

            {status === "success" && result?.data && (
              <div className="space-y-4">
                <Alert className="border-blue-500 bg-blue-50">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    找到云端数据，包含 <strong>{result.bookCount}</strong> 本书籍
                  </AlertDescription>
                </Alert>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <p className="font-medium">确认要恢复数据吗？</p>
                  <p className="text-amber-700">云端数据将覆盖您当前设备上的所有数据</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setStatus("idle")}
                    variant="outline"
                    className="flex-1"
                  >
                    取消
                  </Button>
                  <Button onClick={handleConfirmRestore} className="flex-1">
                    确认恢复
                  </Button>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <Alert className="border-red-500 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {result?.error || "同步码无效，请检查是否输入正确"}
                  </AlertDescription>
                </Alert>
                <Button onClick={() => setStatus("idle")} variant="outline" className="w-full">
                  重新输入
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

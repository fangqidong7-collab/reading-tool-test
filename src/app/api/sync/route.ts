import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

// 生成8位同步码（排除容易混淆的字符：0和O，1和I和L）
const SYNC_CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateSyncCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += SYNC_CODE_CHARS.charAt(Math.floor(Math.random() * SYNC_CODE_CHARS.length));
  }
  return code;
}

// 上传数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json({ error: "数据不能为空" }, { status: 400 });
    }

    // 检查数据大小（限制10MB）
    const dataSize = new Blob([data]).size;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (dataSize > MAX_SIZE) {
      return NextResponse.json(
        { error: "数据过大，请删除部分书籍后重试" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    const syncCode = generateSyncCode();
    const now = new Date().toISOString();

    // 使用 upsert 插入或更新数据
    const { error } = await client
      .from("sync_data")
      .upsert(
        {
          sync_code: syncCode,
          data: data,
          created_at: now,
          updated_at: now,
        },
        { onConflict: "sync_code" }
      );

    if (error) {
      console.error("上传同步数据失败:", error);
      return NextResponse.json(
        { error: `上传失败: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      syncCode: syncCode,
      dataSize: dataSize,
    });
  } catch (err) {
    console.error("上传同步数据异常:", err);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}

// 下载数据
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const syncCode = searchParams.get("code");

    if (!syncCode) {
      return NextResponse.json({ error: "同步码不能为空" }, { status: 400 });
    }

    // 验证同步码格式（8位大写字母数字）
    if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(syncCode)) {
      return NextResponse.json({ error: "同步码格式不正确" }, { status: 400 });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("sync_data")
      .select("data, created_at, updated_at")
      .eq("sync_code", syncCode)
      .maybeSingle();

    if (error) {
      console.error("查询同步数据失败:", error);
      return NextResponse.json(
        { error: `查询失败: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "同步码无效，请检查是否输入正确" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: data.data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  } catch (err) {
    console.error("下载同步数据异常:", err);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}

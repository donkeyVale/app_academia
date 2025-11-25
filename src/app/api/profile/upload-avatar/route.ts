import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-service';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const userId = formData.get('userId');
    const file = formData.get('file');

    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ error: 'Falta userId.' }, { status: 400 });
    }

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Archivo inválido.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filePath = `avatars/${userId}-${Date.now()}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, buffer, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message ?? 'No se pudo subir la imagen.' },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('avatars').getPublicUrl(filePath);

    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        avatar_url: publicUrl,
      },
    });

    if (metaError) {
      return NextResponse.json(
        { error: metaError.message ?? 'Imagen subida, pero no se pudo actualizar el perfil.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: publicUrl });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Error inesperado subiendo la foto de perfil.' },
      { status: 500 }
    );
  }
}

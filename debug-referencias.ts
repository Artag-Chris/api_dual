import { prismaLegacyService } from './src/database/legacy/prisma-legacy.service';
import { prismaMainService } from './src/database/main/prisma-main.service';
import { ReferenceParser } from './src/modules/main-data/reference-parser';

async function debugReferencias() {
  try {
    console.log('\n📋 DEBUG: Verificando datos de referencias en legacy...\n');

    // Obtener un cliente de prueba con estudios
    const clientesConEstudios = await prismaLegacyService.clientes.findMany({
      where: {
        estudios: {
          some: {
            ref_1: {
              not: null,
            },
          },
        },
      },
      include: {
        estudios: {
          select: {
            ref_1: true,
            ref_2: true,
            ref_3: true,
            ref_4: true,
          },
        },
      },
      take: 3,
    });

    console.log(`✓ Encontrados ${clientesConEstudios.length} clientes con referencias\n`);

    // Obtener lista de parentescos
    const listaParentescos = await prismaMainService.lista_parentesco.findMany({
      select: { tipo: true },
    });
    const parentescosArray = listaParentescos.map((p) => p.tipo);
    console.log(`✓ Parentescos disponibles: ${parentescosArray.join(', ')}\n`);

    // Probar parser
    const parser = new ReferenceParser(parentescosArray);

    for (const cliente of clientesConEstudios) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Cliente: ${cliente.num_doc} (ID: ${cliente.id})`);
      console.log(`${'='.repeat(80)}`);

      for (const estudio of cliente.estudios) {
        for (let i = 1; i <= 4; i++) {
          const refField = `ref_${i}` as keyof typeof estudio;
          const comentario = estudio[refField];

          if (comentario) {
            console.log(`\n[ref_${i}] Raw value:`);
            console.log(`  "${comentario}"`);
            console.log(`  Length: ${comentario.length}`);

            const parsed = parser.parseComentario(comentario, cliente.id);
            if (parsed) {
              console.log(`  ✓ Parsed:`, {
                nombre: parsed.nombre,
                celular: parsed.celular,
                parentesco: parsed.parentesco,
                direccion: parsed.direccion,
              });
            } else {
              console.log(`  ✗ Failed to parse`);
            }
          }
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugReferencias();

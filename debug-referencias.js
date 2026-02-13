"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_legacy_service_1 = require("./src/database/legacy/prisma-legacy.service");
const prisma_main_service_1 = require("./src/database/main/prisma-main.service");
const reference_parser_1 = require("./src/modules/main-data/reference-parser");
function debugReferencias() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('\n📋 DEBUG: Verificando datos de referencias en legacy...\n');
            // Obtener un cliente de prueba con estudios
            const clientesConEstudios = yield prisma_legacy_service_1.prismaLegacyService.clientes.findMany({
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
            const listaParentescos = yield prisma_main_service_1.prismaMainService.lista_parentesco.findMany({
                select: { tipo: true },
            });
            const parentescosArray = listaParentescos.map((p) => p.tipo);
            console.log(`✓ Parentescos disponibles: ${parentescosArray.join(', ')}\n`);
            // Probar parser
            const parser = new reference_parser_1.ReferenceParser(parentescosArray);
            for (const cliente of clientesConEstudios) {
                console.log(`\n${'='.repeat(80)}`);
                console.log(`Cliente: ${cliente.num_doc} (ID: ${cliente.id})`);
                console.log(`${'='.repeat(80)}`);
                for (const estudio of cliente.estudios) {
                    for (let i = 1; i <= 4; i++) {
                        const refField = `ref_${i}`;
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
                            }
                            else {
                                console.log(`  ✗ Failed to parse`);
                            }
                        }
                    }
                }
            }
            process.exit(0);
        }
        catch (error) {
            console.error('Error:', error);
            process.exit(1);
        }
    });
}
debugReferencias();

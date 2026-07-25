#!/usr/bin/env python3

"""
Converte um arquivo JSON de receita em um CSV principal e cria CSVs
separados para cada atributo que contenha uma lista.

Exemplo:

    python json_to_csv.py "request (2).json" request.csv

Arquivos gerados:

    request.csv
    fermentables_request.csv
    hops_request.csv
    yeasts_request.csv
    mash_request.csv
    fermentation_request.csv
    salts_request.csv

Regras:

1. O prefixo "draft." não é incluído nos nomes das colunas.
2. O atributo "seed" é ignorado.
3. Atributos que são listas são removidos do CSV principal.
4. Cada lista gera um CSV separado.
5. Cada elemento da lista corresponde a uma linha do CSV da lista.
6. Objetos aninhados são achatados usando notação de ponto.
"""


import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


IGNORED_ATTRIBUTES = {"seed"}


def flatten_object(
    value: Any,
    parent_key: str = "",
    separator: str = ".",
) -> Dict[str, Any]:
    """
    Achata objetos JSON aninhados.

    Exemplo:

        {
            "baseWaterProfile": {
                "calciumPpm": 10
            }
        }

    Resultado:

        {
            "baseWaterProfile.calciumPpm": 10
        }

    Listas não são achatadas nesta função. Elas são tratadas
    separadamente pelo conversor.
    """
    flattened = {}

    if isinstance(value, dict):
        for key, child_value in value.items():
            if key in IGNORED_ATTRIBUTES:
                continue

            new_key = (
                f"{parent_key}{separator}{key}"
                if parent_key
                else str(key)
            )

            if isinstance(child_value, list):
                # A lista será processada separadamente.
                continue

            flattened.update(
                flatten_object(
                    child_value,
                    parent_key=new_key,
                    separator=separator,
                )
            )

    elif isinstance(value, list):
        # Listas não devem ser achatadas no CSV principal.
        return flattened

    else:
        flattened[parent_key] = value

    return flattened


def flatten_list_element(
    value: Any,
    parent_key: str = "",
    separator: str = ".",
) -> Dict[str, Any]:
    """
    Achata um elemento individual de uma lista.

    Exemplo:

        {
            "name": "Citra",
            "details": {
                "alpha": 12
            }
        }

    Resultado:

        {
            "name": "Citra",
            "details.alpha": 12
        }
    """
    flattened = {}

    if isinstance(value, dict):
        for key, child_value in value.items():
            if key in IGNORED_ATTRIBUTES:
                continue

            new_key = (
                f"{parent_key}{separator}{key}"
                if parent_key
                else str(key)
            )

            if isinstance(child_value, list):
                # Caso um elemento contenha outra lista, ela será
                # serializada como JSON dentro da célula.
                flattened[new_key] = json.dumps(
                    child_value,
                    ensure_ascii=False,
                )
            else:
                flattened.update(
                    flatten_list_element(
                        child_value,
                        parent_key=new_key,
                        separator=separator,
                    )
                )

    elif isinstance(value, list):
        flattened[parent_key] = json.dumps(
            value,
            ensure_ascii=False,
        )

    else:
        flattened[parent_key] = value

    return flattened


def normalize_csv_value(value: Any) -> Any:
    """
    Normaliza valores antes de gravá-los no CSV.
    """
    if value is None:
        return ""

    if isinstance(value, bool):
        return str(value).lower()

    return value


def collect_draft_data(
    draft: Dict[str, Any],
) -> Tuple[Dict[str, Any], Dict[str, List[Any]]]:
    """
    Separa os atributos do draft em:

    - atributos não-lista, destinados ao CSV principal;
    - atributos lista, destinados a CSVs separados.
    """
    scalar_data = {}
    list_data = {}

    for key, value in draft.items():
        if key in IGNORED_ATTRIBUTES:
            continue

        if isinstance(value, list):
            list_data[key] = value
            continue

        flattened = flatten_object(value, parent_key=key)
        scalar_data.update(flattened)

    return scalar_data, list_data


def write_single_row_csv(
    output_path: Path,
    row: Dict[str, Any],
) -> None:
    """
    Grava o CSV principal, contendo uma única linha.
    """
    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    fieldnames = list(row.keys())

    with output_path.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as output_file:
        writer = csv.DictWriter(
            output_file,
            fieldnames=fieldnames,
            extrasaction="ignore",
        )

        writer.writeheader()

        writer.writerow(
            {
                key: normalize_csv_value(value)
                for key, value in row.items()
            }
        )


def write_list_csv(
    output_path: Path,
    values: Iterable[Any],
) -> None:
    """
    Grava um CSV para uma lista.

    Cada elemento da lista corresponde a uma linha.
    As colunas são a união dos atributos encontrados em todos
    os elementos.
    """
    flattened_rows = []

    for value in values:
        if isinstance(value, dict):
            flattened = flatten_list_element(value)
        else:
            flattened = {"value": value}

        flattened_rows.append(flattened)

    if not flattened_rows:
        # Para listas vazias, cria um CSV válido, sem linhas de dados.
        with output_path.open(
            "w",
            newline="",
            encoding="utf-8",
        ) as output_file:
            output_file.write("")

        return

    fieldnames = []

    for row in flattened_rows:
        for fieldname in row:
            if fieldname not in fieldnames:
                fieldnames.append(fieldname)

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with output_path.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as output_file:
        writer = csv.DictWriter(
            output_file,
            fieldnames=fieldnames,
            extrasaction="ignore",
        )

        writer.writeheader()

        for row in flattened_rows:
            writer.writerow(
                {
                    fieldname: normalize_csv_value(
                        row.get(fieldname, "")
                    )
                    for fieldname in fieldnames
                }
            )


def build_list_output_path(
    main_csv_path: Path,
    list_attribute: str,
) -> Path:
    """
    Cria o nome do arquivo CSV derivado.

    Exemplo:

        request.csv + fermentables
        -> fermentables_request.csv
    """
    return main_csv_path.parent / (
        f"{list_attribute}_{main_csv_path.stem}"
        f"{main_csv_path.suffix}"
    )


def convert_json_to_csv(
    input_json_path: Path,
    output_csv_path: Path,
) -> List[Path]:
    """
    Executa a conversão completa.

    Retorna a lista dos arquivos gerados.
    """
    if not input_json_path.exists():
        raise FileNotFoundError(
            f"Arquivo JSON não encontrado: {input_json_path}"
        )

    with input_json_path.open(
        "r",
        encoding="utf-8",
    ) as input_file:
        data = json.load(input_file)

    if not isinstance(data, dict):
        raise ValueError(
            "O JSON raiz precisa ser um objeto."
        )

    # O arquivo de entrada possui os dados dentro de "draft".
    # Caso "draft" não exista, o objeto raiz será utilizado.
    draft = data.get("draft", data)

    if not isinstance(draft, dict):
        raise ValueError(
            "O atributo 'draft' precisa ser um objeto."
        )

    scalar_data, list_data = collect_draft_data(draft)

    generated_files = []

    # Gera o CSV principal.
    write_single_row_csv(
        output_path=output_csv_path,
        row=scalar_data,
    )

    generated_files.append(output_csv_path)

    # Gera um CSV individual para cada lista.
    for list_attribute, values in list_data.items():
        list_output_path = build_list_output_path(
            main_csv_path=output_csv_path,
            list_attribute=list_attribute,
        )

        write_list_csv(
            output_path=list_output_path,
            values=values,
        )

        generated_files.append(list_output_path)

    return generated_files

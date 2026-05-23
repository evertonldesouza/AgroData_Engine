using AgroData.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace AgroData.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CommoditiesController : ControllerBase
{
    private readonly ICommodityService _service;
    private readonly ILogger<CommoditiesController> _logger;

    public CommoditiesController(ICommodityService service, ILogger<CommoditiesController> logger)
    {
        _service = service;
        _logger = logger;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var result = await _service.GetLatestPricesAsync();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao buscar commodities");
            return StatusCode(500);
        }
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var result = await _service.GetByIdAsync(id);
            if (result is null) return NotFound();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao buscar commodity {Id}", id);
            return StatusCode(500);
        }
    }
}